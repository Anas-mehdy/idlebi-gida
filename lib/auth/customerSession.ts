import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hashToken } from './crypto';

export interface CustomerSessionResult {
  isAllowed: boolean;
  status: 'approved' | 'pending' | 'rejected' | 'blocked' | 'suspended' | 'unauthorized';
  customerId?: string;
  customerName?: string;
  deviceId?: string;
  showPrices: boolean;
  redirectUrl?: string;
}

export function isDeviceProtectionEnabled(): boolean {
  return process.env.ENABLE_CUSTOMER_DEVICE_PROTECTION !== 'false';
}

/**
 * Verify customer device session on server.
 * Handles approved, pending, rejected, blocked, and suspended states.
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

  const approvedCookie = request.cookies.get('customer_device_session');
  const pendingCookie = request.cookies.get('customer_pending_session');

  // Check approved device session first
  if (approvedCookie?.value) {
    try {
      const sessionHash = hashToken(approvedCookie.value);

      const { data: sessionData, error: sessionError } = await supabase
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
            showPrices: customer.show_prices ?? true
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

  // Check pending device session
  if (pendingCookie?.value) {
    try {
      const deviceHash = hashToken(pendingCookie.value);
      const { data: deviceData } = await supabase
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
          // Device has been approved by admin! Needs full session upgrade.
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
