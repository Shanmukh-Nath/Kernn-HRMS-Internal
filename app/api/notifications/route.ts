import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  announcementsCol,
  leaveRequestsCol,
  leaveTypesCol,
  attendanceRegularizationsCol,
  payrollRecordsCol,
  notificationReadsCol,
  employeesCol,
  generateId,
} from '@/lib/mongodb';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const annCol = await announcementsCol();
    const lrCol = await leaveRequestsCol();
    const ltCol = await leaveTypesCol();
    const regCol = await attendanceRegularizationsCol();
    const empCol = await employeesCol();
    const nrCol = await notificationReadsCol();

    const currentUserId = session.userId;
    const employeeId = session.employeeId;
    const isManagerOrAdmin =
      session.role === 'SUPER_ADMIN' ||
      session.role === 'HR_ADMIN' ||
      session.role === 'MANAGER';

    // 1. Fetch User's Read Notification IDs
    const readDocs = await nrCol.find({ userId: currentUserId }).toArray();
    const readIds = new Set(readDocs.map((d) => d.notificationId));

    const notifications: any[] = [];

    // 2. Fetch Announcements
    const announcements = await annCol
      .find({})
      .sort({ publishedAt: -1 })
      .limit(10)
      .toArray();

    announcements.forEach((a) => {
      const notifId = `ann_${a.id || a._id}`;
      notifications.push({
        id: notifId,
        type: 'ANNOUNCEMENT',
        title: a.title,
        message: a.content ? a.content.substring(0, 120) + (a.content.length > 120 ? '...' : '') : '',
        priority: a.priority || 'NORMAL',
        author: a.authorName || 'HR Administration',
        timestamp: a.publishedAt || a.createdAt,
        timeAgo: a.publishedAt ? formatDistanceToNow(new Date(a.publishedAt), { addSuffix: true }) : '',
        link: '/announcements',
        isRead: readIds.has(notifId),
      });
    });

    // 3. Fetch Leave Updates
    const leaveTypes = await ltCol.find({}).toArray();
    const ltMap = new Map(leaveTypes.map((t) => [t.id || t.code, t]));
    const employees = await empCol.find({}).toArray();
    const empMap = new Map(employees.map((e) => [e.id, e]));

    let leaveFilter: Record<string, any> = {};
    if (!isManagerOrAdmin) {
      leaveFilter = { employeeId };
    }

    const recentLeaves = await lrCol
      .find(leaveFilter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(15)
      .toArray();

    recentLeaves.forEach((l) => {
      const lt = ltMap.get(l.leaveTypeId);
      const emp = empMap.get(l.employeeId);
      const notifId = `leave_${l.id || l._id}_${l.status}`;

      let title = '';
      let message = '';

      if (l.status === 'APPROVED') {
        title = `Leave Approved: ${lt?.name || 'Leave'}`;
        message = isManagerOrAdmin && l.employeeId !== employeeId
          ? `${emp?.name || 'Employee'}'s ${lt?.name || 'leave'} for ${l.totalDays} day(s) was approved.`
          : `Your request for ${l.totalDays} day(s) ${lt?.name || 'leave'} has been APPROVED.`;
      } else if (l.status === 'REJECTED') {
        title = `Leave Rejected: ${lt?.name || 'Leave'}`;
        message = isManagerOrAdmin && l.employeeId !== employeeId
          ? `${emp?.name || 'Employee'}'s ${lt?.name || 'leave'} request was rejected.`
          : `Your leave request for ${l.totalDays} day(s) was REJECTED.${l.rejectionReason ? ` Reason: ${l.rejectionReason}` : ''}`;
      } else if (l.status === 'PENDING' && isManagerOrAdmin) {
        title = `Action Required: New Leave Request`;
        message = `${emp?.name || 'Employee'} applied for ${l.totalDays} day(s) of ${lt?.name || 'leave'}.`;
      }

      if (title) {
        notifications.push({
          id: notifId,
          type: 'LEAVE',
          title,
          message,
          priority: l.status === 'PENDING' ? 'HIGH' : 'NORMAL',
          status: l.status,
          timestamp: l.updatedAt || l.createdAt,
          timeAgo: l.updatedAt ? formatDistanceToNow(new Date(l.updatedAt), { addSuffix: true }) : '',
          link: isManagerOrAdmin ? '/approvals' : '/leaves',
          isRead: readIds.has(notifId),
        });
      }
    });

    // 4. Fetch Attendance Regularization Updates
    let regFilter: Record<string, any> = {};
    if (!isManagerOrAdmin) {
      regFilter = { employeeId };
    }

    const recentRegs = await regCol
      .find(regFilter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(15)
      .toArray();

    recentRegs.forEach((r) => {
      const emp = empMap.get(r.employeeId);
      const notifId = `reg_${r.id || r._id}_${r.status}`;

      let title = '';
      let message = '';

      if (r.status === 'APPROVED') {
        title = `Attendance Regularized: ${r.date}`;
        message = isManagerOrAdmin && r.employeeId !== employeeId
          ? `Punch regularization for ${emp?.name || 'Staff'} on ${r.date} was approved.`
          : `Your punch correction for ${r.date} has been regularized by manager.`;
      } else if (r.status === 'REJECTED') {
        title = `Regularization Rejected: ${r.date}`;
        message = isManagerOrAdmin && r.employeeId !== employeeId
          ? `Punch correction for ${emp?.name || 'Staff'} on ${r.date} was rejected.`
          : `Your punch correction for ${r.date} was rejected.${r.rejectionReason ? ` Reason: ${r.rejectionReason}` : ''}`;
      } else if (r.status === 'PENDING' && isManagerOrAdmin) {
        title = `Action Required: Attendance Regularization`;
        message = `${r.employeeName || emp?.name || 'Staff'} requested time correction for ${r.date}.`;
      }

      if (title) {
        notifications.push({
          id: notifId,
          type: 'REGULARIZATION',
          title,
          message,
          priority: r.status === 'PENDING' ? 'HIGH' : 'NORMAL',
          status: r.status,
          timestamp: r.updatedAt || r.reviewedAt || r.createdAt,
          timeAgo: r.createdAt ? formatDistanceToNow(new Date(r.createdAt), { addSuffix: true }) : '',
          link: isManagerOrAdmin ? '/approvals' : '/daily-attendance',
          isRead: readIds.has(notifId),
        });
      }
    });

    // Sort all notifications newest first
    notifications.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const currentUserId = session.userId;
    const body = await req.json();
    const { action, notificationId, notificationIds } = body;
    const nrCol = await notificationReadsCol();
    const now = new Date();

    if (action === 'MARK_ALL_READ' && Array.isArray(notificationIds)) {
      const docs = notificationIds.map((nid: string) => ({
        id: generateId(),
        userId: currentUserId,
        notificationId: nid,
        readAt: now,
      }));
      if (docs.length > 0) {
        // Upsert by userId + notificationId
        for (const doc of docs) {
          await nrCol.updateOne(
            { userId: currentUserId, notificationId: doc.notificationId },
            { $set: { readAt: now }, $setOnInsert: { id: doc.id, userId: doc.userId, notificationId: doc.notificationId } },
            { upsert: true }
          );
        }
      }
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (notificationId) {
      await nrCol.updateOne(
        { userId: currentUserId, notificationId },
        { $set: { readAt: now }, $setOnInsert: { id: generateId(), userId: currentUserId, notificationId } },
        { upsert: true }
      );
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json({ success: false, error: { code: 'INVALID_REQUEST' } }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
