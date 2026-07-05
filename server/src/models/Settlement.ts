import { Schema, model, Document, Types } from 'mongoose';

// ─── TypeScript Interface ────────────────────────────────────────────────────
export type SettlementStatus = 'pending' | 'completed' | 'rejected';

export interface ISettlement extends Document {
  groupId: Types.ObjectId;
  fromUser: Types.ObjectId;
  toUser: Types.ObjectId;
  amount: number;
  currency: string;
  status: SettlementStatus;
  notes?: string;
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mongoose Schema ──────────────────────────────────────────────────────────
const SettlementSchema = new Schema<ISettlement>(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    fromUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Settlement amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'rejected'],
      default: 'pending',
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    settledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

SettlementSchema.index({ groupId: 1 });
SettlementSchema.index({ fromUser: 1, status: 1 });
SettlementSchema.index({ toUser: 1, status: 1 });

export const Settlement = model<ISettlement>('Settlement', SettlementSchema);
