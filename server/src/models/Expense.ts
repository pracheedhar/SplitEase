import { Schema, model, Document, Types } from 'mongoose';

// ─── TypeScript Interfaces ────────────────────────────────────────────────────
export type SplitType = 'equal' | 'exact' | 'percentage' | 'shares';

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'entertainment'
  | 'utilities'
  | 'shopping'
  | 'health'
  | 'education'
  | 'other';

export interface IPayer {
  userId: Types.ObjectId;
  amount: number;
}

export interface IParticipant {
  userId: Types.ObjectId;
  share?: number;       // For 'shares' split type
  amount?: number;      // For 'exact' split type
  percentage?: number;  // For 'percentage' split type
}

export interface IAttachment {
  url: string;
  publicId: string;   // Cloudinary public ID for deletion
  originalName: string;
  uploadedAt: Date;
}

export interface IExpense extends Document {
  groupId: Types.ObjectId;
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidBy: IPayer[];          // Supports multi-payer
  splitType: SplitType;
  participants: IParticipant[];
  attachments: IAttachment[];
  isRecurring: boolean;
  recurringInterval?: 'daily' | 'weekly' | 'monthly';
  notes?: string;
  date: Date;
  createdBy: Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const PayerSchema = new Schema<IPayer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ParticipantSchema = new Schema<IParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    share: { type: Number, min: 0 },
    amount: { type: Number, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

const AttachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    originalName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Mongoose Schema ──────────────────────────────────────────────────────────
const ExpenseSchema = new Schema<IExpense>(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },
    category: {
      type: String,
      enum: ['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'shopping', 'health', 'education', 'other'],
      default: 'other',
    },
    paidBy: {
      type: [PayerSchema],
      required: true,
      validate: {
        validator: (v: IPayer[]) => v && v.length > 0,
        message: 'At least one payer is required',
      },
    },
    splitType: {
      type: String,
      enum: ['equal', 'exact', 'percentage', 'shares'],
      required: true,
    },
    participants: {
      type: [ParticipantSchema],
      required: true,
      validate: {
        validator: (v: IParticipant[]) => v && v.length > 0,
        message: 'At least one participant is required',
      },
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringInterval: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound indexes for common query patterns
ExpenseSchema.index({ groupId: 1, createdAt: -1 });
ExpenseSchema.index({ groupId: 1, isDeleted: 1 });
ExpenseSchema.index({ 'paidBy.userId': 1 });
ExpenseSchema.index({ 'participants.userId': 1 });
ExpenseSchema.index({ createdBy: 1 });

export const Expense = model<IExpense>('Expense', ExpenseSchema);
