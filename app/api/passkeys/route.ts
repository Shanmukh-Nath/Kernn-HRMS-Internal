import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { passkeysCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const pkCol = await passkeysCol();
    const passkeys = await pkCol
      .find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: passkeys.map((p) => ({
        id: p.id || p._id?.toString(),
        credentialId: p.credentialId,
        deviceName: p.deviceName,
        deviceType: p.deviceType,
        os: p.os,
        browser: p.browser,
        createdAt: p.createdAt,
        lastUsedAt: p.lastUsedAt,
      })),
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
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { credentialId, publicKey, deviceName, deviceType, os, browser } = body;

    if (!credentialId || !deviceName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Credential ID and device name are required' } },
        { status: 400 }
      );
    }

    const pkCol = await passkeysCol();
    const now = new Date();

    const existing = await pkCol.findOne({
      userId: session.userId,
      $or: [{ credentialId }, { deviceName, os }],
    });

    if (existing) {
      await pkCol.updateOne(
        { _id: existing._id },
        {
          $set: {
            credentialId,
            publicKey: publicKey || 'verified_key',
            browser: browser || 'Browser',
            lastUsedAt: now,
          },
        }
      );

      return NextResponse.json({
        success: true,
        data: { id: existing.id || existing._id.toString(), credentialId, deviceName },
        message: `Passkey refreshed for ${deviceName}. Duplicate entry prevented.`,
      });
    }

    const id = generateId();
    await pkCol.insertOne({
      id,
      userId: session.userId,
      credentialId,
      publicKey: publicKey || 'verified_key',
      counter: 0,
      deviceName,
      deviceType: deviceType || 'DESKTOP',
      os: os || 'WINDOWS',
      browser: browser || 'Browser',
      createdAt: now,
      lastUsedAt: now,
    });

    return NextResponse.json({
      success: true,
      data: { id, credentialId, deviceName },
      message: `Passkey successfully enrolled for ${deviceName}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ENROLL_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Passkey ID is required' } },
        { status: 400 }
      );
    }

    const pkCol = await passkeysCol();
    const result = await pkCol.deleteOne({
      userId: session.userId,
      $or: [{ id }, { _id: id }],
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Passkey not found or unauthorized' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Passkey revoked successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
