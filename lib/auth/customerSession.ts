import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hashToken } from './crypto';

export interface CustomerSessionResult {
  isAllowed: boolean;
  status: 'approved' | 'pending' | 'rejected' | 'blocked' | 'suspended' | 'unauthorized';
  customerId?: string;
  customerName?: string;
  deviceId?: string;
  showPrices: boolean;
  redirectUrl?: string;
  rehydrateToken?: string; // Token from header to re-set as cookie if cookie was lost
}

export function isDeviceProtectionEnabled(): boolean {
  return process.env.ENABLE_CUSTOMER_DEVICE_PROTECTION !== 'false';
}

/**
 * Verify customer device session on server.
 * Handles approved, pending, rejected, blocked, and suspended states.
 * Supports dual-persistence (Cookie + Header token) to safeguard against iOS Safari ITP cookie deletion.
 */
export async function verifyCustomerSession(request: NextRequest): Promise<CustomerSessionResult> {
  // If protection feature flag is explicitly disabled, grant access with prices enabled
  if (!isDeviceProtectionEnabled()) {
    return {
      isAllowed: true,
      status: 'approved',
      showPrices: true
    };
  }

  // 1. Check approved device session token (from Cookie OR Header)
  const cookieApprovedToken = request.cookies.get('customer_device_session')?.value;
  const headerApprovedToken = request.headers.get('x-customer-device-token')?.trim();
  const approvedToken = cookieApprovedToken || headerApprovedToken;

  if (approvedToken) {
    try {
      const sessionHash = hashToken(approvedToken);

      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('customer_sessions')
        .select(`
          id,
          expires_at,
          customer_id,
          device_id,
          customer_devices!inner (
            id,
            status,
            device_name
          ),
          customers!inner (
            id,
            name,
            show_prices,
            status
          )
        `)
        .eq('session_token_hash', sessionHash)
        .single();

      if (!sessionError && sessionData) {
        const customer = sessionData.customers as any;
        const device = sessionData.customer_devices as any;
        const expiresAt = new Date(sessionData.expires_at).getTime();

        // Check if customer is suspended
        if (customer.status === 'suspended') {
          return {
            isAllowed: false,
            status: 'suspended',
            redirectUrl: '/access/status?reason=suspended',
            showPrices: false
          };
        }

        // Check if device is approved and session not expired
        if (device.status === 'approved' && expiresAt > Date.now()) {
          return {
            isAllowed: true,
            status: 'approved',
            customerId: customer.id,
            customerName: customer.name,
            deviceId: device.id,
            showPrices: customer.show_prices ?? true,
            rehydrateToken: !cookieApprovedToken && headerApprovedToken ? headerApprovedToken : undefined
          };
        } else if (device.status === 'blocked') {
          return {
            isAllowed: false,
            status: 'blocked',
            redirectUrl: '/access/status?reason=blocked',
            showPrices: false
          };
        } else if (device.status === 'rejected') {
          return {
            isAllowed: false,
            status: 'rejected',
            redirectUrl: '/access/status?reason=rejected',
            showPrices: false
          };
        }
      }
    } catch (err) {
      console.error('Error verifying customer session:', err);
    }
  }

  // 2. Check pending device session token (from Cookie OR Header)
  const cookiePendingToken = request.cookies.get('customer_pending_session')?.value;
  const headerPendingToken = request.headers.get('x-customer-pending-token')?.trim();
  const pendingToken = cookiePendingToken || headerPendingToken;

  if (pendingToken) {
    try {
      const deviceHash = hashToken(pendingToken);
      const { data: deviceData } = await supabaseAdmin
        .from('customer_devices')
        .select('id, status, customer_id, customers(name, status)')
        .eq('device_token_hash', deviceHash)
        .single();

      if (deviceData) {
        const customer = deviceData.customers as any;
        if (customer?.status === 'suspended') {
          return {
            isAllowed: false,
            status: 'suspended',
            redirectUrl: '/access/status?reason=suspended',
            showPrices: false
          };
        }

        if (deviceData.status === 'approved') {
          return {
            isAllowed: true,
            status: 'approved',
            customerId: deviceData.customer_id,
            customerName: customer?.name,
            deviceId: deviceData.id,
            showPrices: true
          };
        } else if (deviceData.status === 'pending') {
          return {
            isAllowed: false,
            status: 'pending',
            redirectUrl: '/access/status?reason=pending',
            showPrices: false
          };
        } else if (deviceData.status === 'rejected') {
          return {
            isAllowed: false,
            status: 'rejected',
            redirectUrl: '/access/status?reason=rejected',
            showPrices: false
          };
        } else if (deviceData.status === 'blocked') {
          return {
            isAllowed: false,
            status: 'blocked',
            redirectUrl: '/access/status?reason=blocked',
            showPrices: false
          };
        }
      }
    } catch (err) {
      console.error('Error checking pending device:', err);
    }
  }

  return {
    isAllowed: false,
    status: 'unauthorized',
    redirectUrl: '/access/status?reason=unauthorized',
    showPrices: false
  };
}
