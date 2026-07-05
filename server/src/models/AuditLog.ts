import { Schema, model, Document, Types } from 'mongoose';

// ─── TypeScript Interface ────────────────────────────────────────────────────
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'settle';

export type AuditEntity =
  | 'User'
  | 'Group'
  | 'Expense'
  | 'Settlement'
  | 'Notification';

export interface IAuditLog extends Document {
  userId: Types.ObjectId;
  action: AuditAction;
  entity: AuditEntity;
  entityId: Types.ObjectId;
  metadata?: Record<string, unknown>;  // Any extra context (diff, IP, etc.)
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ─── Mongoose Schema ──────────────────────────────────────────────────────────
const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'login', 'logout', 'settle'],
      required: true,
    },
    entity: {
      type: String,
      enum: ['User', 'Group', 'Expense', 'Settlement', 'Notification'],
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// For querying audit history by user or by entity
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);
