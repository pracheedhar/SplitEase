import { Schema, model, Document, Types } from 'mongoose';

// ─── TypeScript Interface ────────────────────────────────────────────────────
export type NotificationType =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_request'
  | 'settlement_completed'
  | 'group_invite'
  | 'member_joined'
  | 'member_left'
  | 'reminder';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  message: string;
  read: boolean;
  relatedId?: Types.ObjectId;   // e.g. expenseId, groupId, settlementId
  relatedModel?: 'Expense' | 'Group' | 'Settlement';
  createdAt: Date;
}

// ─── Mongoose Schema ──────────────────────────────────────────────────────────
const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'expense_added',
        'expense_updated',
        'expense_deleted',
        'settlement_request',
        'settlement_completed',
        'group_invite',
        'member_joined',
        'member_left',
        'reminder',
      ],
      required: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    read: {
      type: Boolean,
      default: false,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
    },
    relatedModel: {
      type: String,
      enum: ['Expense', 'Group', 'Settlement'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// For fast unread notification counts per user
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', NotificationSchema);
