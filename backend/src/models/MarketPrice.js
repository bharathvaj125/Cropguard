import mongoose from 'mongoose';

/** One mandi price record: a commodity, in one market, on one day. Prices are Rs per quintal. */
const marketPriceSchema = new mongoose.Schema(
  {
    commodity: { type: String, required: true, trim: true, index: true },
    variety: { type: String, trim: true, default: '' },
    state: { type: String, required: true, trim: true },
    district: { type: String, trim: true, default: '' },
    market: { type: String, required: true, trim: true },
    date: { type: Date, required: true }, // midnight UTC of the trading day
    minPrice: { type: Number, required: true, min: 0 },
    maxPrice: { type: Number, required: true, min: 0 },
    modalPrice: { type: Number, required: true, min: 0 },
    // 'sample'    generated demo series bundled with the project
    // 'agmarknet' pulled from data.gov.in
    // 'manual'    typed in by an admin
    source: { type: String, enum: ['sample', 'agmarknet', 'manual'], default: 'sample', index: true },
  },
  { timestamps: true },
);

marketPriceSchema.index({ commodity: 1, market: 1, date: 1 }, { unique: true });
marketPriceSchema.index({ commodity: 1, date: -1 });

marketPriceSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const MarketPrice = mongoose.model('MarketPrice', marketPriceSchema);
