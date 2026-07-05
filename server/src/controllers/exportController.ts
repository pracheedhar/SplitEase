import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Expense, Group } from '../models/index.js';
import { createObjectCsvStringifier } from 'csv-writer';
import { logger } from '../utils/logger.js';

export const exportGroupCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) { res.status(404).json({ status: 'fail', message: 'Group not found.' }); return; }

    const expenses = await Expense.find({ groupId: new Types.ObjectId(groupId), isDeleted: false })
      .sort({ date: -1 })
      .populate('paidBy.userId', 'name')
      .populate('participants.userId', 'name')
      .lean();

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'date', title: 'Date' },
        { id: 'title', title: 'Title' },
        { id: 'amount', title: 'Amount' },
        { id: 'currency', title: 'Currency' },
        { id: 'category', title: 'Category' },
        { id: 'splitType', title: 'Split Type' },
        { id: 'paidBy', title: 'Paid By' },
        { id: 'participants', title: 'Participants' },
        { id: 'notes', title: 'Notes' },
      ],
    });

    const records = expenses.map((e: any) => ({
      date: new Date(e.date).toLocaleDateString(),
      title: e.title,
      amount: e.amount.toFixed(2),
      currency: e.currency,
      category: e.category,
      splitType: e.splitType,
      paidBy: e.paidBy?.map((p: any) => p.userId?.name || p.userId).join(', '),
      participants: e.participants?.map((p: any) => p.userId?.name || p.userId).join(', '),
      notes: e.notes || '',
    }));

    const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${group.name}-expenses.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

export const uploadAttachment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { expenseId } = req.params;
    const file = req.file;
    if (!file) { res.status(400).json({ status: 'fail', message: 'No file uploaded.' }); return; }

    const { uploadToCloudinary } = await import('../utils/fileUpload.js');
    const { url, publicId } = await uploadToCloudinary(file.buffer, file.originalname);

    const expense = await Expense.findById(expenseId);
    if (!expense) { res.status(404).json({ status: 'fail', message: 'Expense not found.' }); return; }

    expense.attachments.push({ url, publicId, originalName: file.originalname, uploadedAt: new Date() });
    await expense.save();

    res.status(200).json({ status: 'success', data: { url, publicId, originalName: file.originalname } });
  } catch (err) {
    next(err);
  }
};
