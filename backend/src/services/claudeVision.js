import { z } from 'zod';
import { callClaudeStructured, fileBlock, llmStatus } from './claudeAdvisor.js';

/**
 * Claude vision for Track A:
 *   readSoilHealthCard(buffer, mediaType)  photo or PDF of a Soil Health Card -> values
 *   gradeProduceWithClaude(buffer, commodity) produce photo -> AGMARK-style grade
 *
 * Both return null when Claude is not configured or cannot answer; callers then fall back to
 * manual entry (soil) or the on-device model / basic image check (produce).
 */

export const visionAvailable = () => llmStatus().enabled;

// ---------------------------------------------------------------------------
// Soil Health Card
// ---------------------------------------------------------------------------

const nullableNumber = z.number().nullable();

export const SoilCardSchema = z.object({
  isSoilHealthCard: z.boolean(),
  sampleId: z.string(),
  values: z.object({
    nitrogen: nullableNumber,
    phosphorus: nullableNumber,
    potassium: nullableNumber,
    ph: nullableNumber,
    ec: nullableNumber,
    organicCarbon: nullableNumber,
    zinc: nullableNumber,
    iron: nullableNumber,
    sulphur: nullableNumber,
    boron: nullableNumber,
  }),
  notes: z.array(z.string()),
});

const SOIL_PROMPT = `You read Indian Soil Health Cards (and similar soil test reports) and copy the test results exactly.

Rules:
- Report only numbers that are clearly printed or written on the document for this sample. Never estimate, infer or fill in typical values. If a value is missing, cut off, blurred, crossed out or you are not certain of every digit, use null.
- Units to report in: nitrogen, phosphorus and potassium in kg/ha (available N, P, K); pH unitless; electrical conductivity (EC) in dS/m (mS/cm is the same number); organic carbon in %; zinc, iron, sulphur and boron in ppm (mg/kg is the same number).
- If phosphorus is given as P2O5, convert to P by multiplying by 0.4364. If potassium is given as K2O, convert to K by multiplying by 0.8301. If a value is in another unit you cannot convert with certainty, use null. Mention every conversion and every null value that had something unreadable printed, in "notes".
- Ignore the ratings, recommendations and fertiliser doses printed on the card; only the measured test values.
- sampleId is the sample or card number as printed, or an empty string.
- If the document is not a soil test report, set isSoilHealthCard to false and every value to null.
- Write notes in short plain English.`;

/** @returns {Promise<null | {isSoilHealthCard, sampleId, values, notes, model}>} */
export async function readSoilHealthCard(buffer, mediaType) {
  const result = await callClaudeStructured({
    system: SOIL_PROMPT,
    messages: [
      {
        role: 'user',
        content: [fileBlock(buffer, mediaType), { type: 'text', text: 'Copy the soil test values from this document.' }],
      },
    ],
    schema: SoilCardSchema,
    label: 'claude soil card',
  });
  if (!result) return null;
  return { ...result.data, model: result.model };
}

// ---------------------------------------------------------------------------
// Produce grading
// ---------------------------------------------------------------------------

export const ProduceGradeSchema = z.object({
  isProduce: z.boolean(),
  commodityDetected: z.string(),
  matchesClaimedCommodity: z.boolean(),
  grade: z.enum(['A', 'B', 'C']),
  certainty: z.enum(['low', 'medium', 'high']),
  uniformity: z.enum(['uniform', 'mostly_uniform', 'varied']),
  defects: z.array(
    z.object({
      type: z.string(),
      severity: z.enum(['mild', 'moderate', 'severe']),
      description: z.string(),
    }),
  ),
  summary: z.string(),
});

const PRODUCE_PROMPT = `You are an AGMARK-trained produce grader in an Indian mandi. You grade a photo of a lot of fruit, vegetables or grain.

Grades:
- A (Super / Grade I): uniform size, shape and colour typical of the variety; firm and fresh; no visible damage, rot, pest marks or disease; at most very minor skin marks.
- B (FAQ / Grade II): fair average quality; some variation in size or colour; minor bruises, scars or skin blemishes on a small share of the lot; no rot.
- C (Undergrade): clear defects such as rot, mould, pest or disease damage, cuts, heavy bruising, shrivelling, or very mixed maturity; or a large share of blemished pieces.

Rules:
- First decide whether the photo shows agricultural produce at all, and what it is. If it is not produce, set isProduce to false and grade C with certainty low.
- matchesClaimedCommodity is false when the produce is clearly a different commodity from the one the farmer named.
- Only list defects you can actually see. A photo cannot show internal quality, taste or weight; do not guess about them.
- certainty is low when the photo is blurry, dark, shows only a few pieces, or the produce is partly hidden.
- summary is one or two plain sentences for the farmer.`;

/** @returns {Promise<null | object>} the ProduceGradeSchema fields plus `model` */
export async function gradeProduceWithClaude(buffer, commodity) {
  const result = await callClaudeStructured({
    system: PRODUCE_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          fileBlock(buffer, 'image/jpeg'),
          { type: 'text', text: `The farmer says this lot is: ${commodity}. Grade it.` },
        ],
      },
    ],
    schema: ProduceGradeSchema,
    label: 'claude produce grade',
  });
  if (!result) return null;
  return { ...result.data, model: result.model };
}
