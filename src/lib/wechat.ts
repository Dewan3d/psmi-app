// ============================================================
// PSMI System — WeChat Notification Engine
// ============================================================
// Sends automated, formatted outbound dispatch notifications to 
// WeChat via PushPlus (100% Free - 200 alerts/day) or ServerChan.
// ============================================================

export interface OutboundNotificationPayload {
  trackingNumber: string;
  route: string;
  fromLocation: string;
  toLocation: string;
  itemsCount: number;
  skus?: string[];
  dispatchedBy?: string;
  notes?: string;
}

export async function sendWeChatOutboundNotification(
  payload: OutboundNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  // PushPlus token (can be configured via environment variable)
  const pushPlusToken = process.env.PUSHPLUS_TOKEN || process.env.NEXT_PUBLIC_PUSHPLUS_TOKEN;
  const serverChanKey = process.env.SERVERCHAN_KEY;

  if (!pushPlusToken && !serverChanKey) {
    console.log('[WeChat Alert] No PUSHPLUS_TOKEN or SERVERCHAN_KEY configured in environment. Skipping notification.');
    return { success: false, error: 'No WeChat notification token configured in environment variables.' };
  }

  const title = `📦 PSMI Alert: New Outbound Shipment (${payload.trackingNumber})`;
  
  const markdownBody = `
### 📦 PSMI System — Outbound Shipment Alert

- **Tracking Number:** \`${payload.trackingNumber}\`
- **Route:** ${payload.route}
- **From:** ${payload.fromLocation}
- **To:** ${payload.toLocation}
- **Quantity:** **${payload.itemsCount} units**
${payload.skus && payload.skus.length > 0 ? `- **Items / SKUs:** ${payload.skus.join(', ')}` : ''}
${payload.dispatchedBy ? `- **Dispatched By:** ${payload.dispatchedBy}` : ''}
${payload.notes ? `- **Notes:** ${payload.notes}` : ''}
- **Dispatch Time:** ${new Date().toLocaleString()}

*Please prepare location/bay for receiving and stock verification.*
`;

  try {
    if (pushPlusToken) {
      const response = await fetch('http://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: pushPlusToken,
          title: title,
          content: markdownBody,
          template: 'markdown',
        }),
      });

      const result = await response.json();
      if (result.code === 200) {
        console.log('[WeChat Alert] PushPlus notification sent successfully!');
        return { success: true };
      } else {
        console.error('[WeChat Alert] PushPlus error:', result.msg);
        return { success: false, error: result.msg };
      }
    }

    if (serverChanKey) {
      const response = await fetch(`https://sctapi.ftqq.com/${serverChanKey}.send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          title: title,
          desp: markdownBody,
        }),
      });

      const result = await response.json();
      if (result.code === 0) {
        console.log('[WeChat Alert] ServerChan notification sent successfully!');
        return { success: true };
      } else {
        console.error('[WeChat Alert] ServerChan error:', result.errmsg);
        return { success: false, error: result.errmsg };
      }
    }
  } catch (err: any) {
    console.error('[WeChat Alert] Error sending request:', err.message);
    return { success: false, error: err.message };
  }

  return { success: false, error: 'Failed to dispatch notification.' };
}
