import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAdminAuth } from '@/lib/auth/adminAuth';
import { generateRandomToken, hashToken } from '@/lib/auth/crypto';

export async function GET(request: NextRequest) {
  const auth = checkAdminAuth(request);
  if (!auth.isAdmin) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  const statusFilter = searchParams.get('status');

  try {
    let query = supabase
      .from('customer_devices')
      .select(`
        *,
        customers!inner (
          id,
          name,
          max_devices,
          status,
          show_prices
        )
      `)
      .order('first_seen_at', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: devices, error } = await query;
    if (error) throw error;

    return NextResponse.json({ devices: devices || [] });
  } catch (err: any) {
    console.error('Error fetching admin devices:', err);
    return NextResponse.json({ error: 'حدث خطأ في قراءة قائمة الأجهزة' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = checkAdminAuth(request);
  if (!auth.isAdmin) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { deviceId, customerId, action } = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === 'approve' && deviceId) {
      // 1. Fetch device & customer info
      const { data: device } = await supabase
        .from('customer_devices')
        .select('id, customer_id, device_token_hash')
        .eq('id', deviceId)
        .single();

      if (!device) {
        return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 });
      }

      // Update device status to approved
      await supabase
        .from('customer_devices')
        .update({ status: 'approved', approved_at: now })
        .eq('id', deviceId);

      // Create a valid customer_session record linked to this device
      const sessionToken = generateRandomToken(32);
      const sessionTokenHash = hashToken(sessionToken);

      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year session

      await supabase.from('customer_sessions').insert({
        customer_id: device.customer_id,
        device_id: deviceId,
        session_token_hash: sessionTokenHash,
        expires_at: expiresAt
      });

      // Log security event
      await supabase.from('security_events').insert({
        customer_id: device.customer_id,
        device_id: deviceId,
        event_type: 'device_approved'
      });

      return NextResponse.json({
        success: true,
        message: 'تم اعتماد الجهاز بنجاح'
      });
    }

    if (action === 'reject' && deviceId) {
      await supabase
        .from('customer_devices')
        .update({ status: 'rejected', rejected_at: now })
        .eq('id', deviceId);

      return NextResponse.json({ success: true, message: 'تم رفض الجهاز' });
    }

    if (action === 'block' && deviceId) {
      await supabase
        .from('customer_devices')
        .update({ status: 'blocked', blocked_at: now })
        .eq('id', deviceId);

      // Revoke any active sessions for this device
      await supabase
        .from('customer_sessions')
        .update({ revoked_at: now })
        .eq('device_id', deviceId);

      return NextResponse.json({ success: true, message: 'تم حظر الجهاز بنجاح' });
    }

    if (action === 'revoke' && deviceId) {
      await supabase
        .from('customer_devices')
        .update({ status: 'revoked', revoked_at: now })
        .eq('id', deviceId);

      await supabase
        .from('customer_sessions')
        .update({ revoked_at: now })
        .eq('device_id', deviceId);

      return NextResponse.json({ success: true, message: 'تم إلغاء اعتماد الجهاز' });
    }

    if (action === 'delete' && deviceId) {
      await supabase.from('customer_devices').delete().eq('id', deviceId);
      return NextResponse.json({ success: true, message: 'تم حذف الجهاز بنجاح' });
    }

    if (action === 'logout_all' && customerId) {
      // Revoke all sessions for this customer
      await supabase
        .from('customer_sessions')
        .update({ revoked_at: now })
        .eq('customer_id', customerId);

      return NextResponse.json({ success: true, message: 'تم تسجيل خروج جميع أجهزة الزبون' });
    }

    if (action === 'update_customer_status' && customerId) {
      const { status } = await request.json(); // 'active' or 'suspended'
      await supabase
        .from('customers')
        .update({ status: status === 'suspended' ? 'suspended' : 'active' })
        .eq('id', customerId);

      return NextResponse.json({
        success: true,
        message: `تم ${status === 'suspended' ? 'إيقاف' : 'تفعيل'} حساب الزبون بنجاح`
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in admin devices API:', err);
    return NextResponse.json({ error: 'حدث خطأ في تنفيذ إجراء الجهاز' }, { status: 500 });
  }
}
