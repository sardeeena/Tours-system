# Meta WhatsApp delivery webhook setup

The delivery callback is implemented at:

`https://awesomeadventure.tours/api/webhooks/whatsapp`

Configure these **server-side Hostinger environment variables** before enabling the callback in Meta:

- `WHATSAPP_APP_SECRET`: the App Secret from Meta for the same app connected to the WhatsApp Business Account. Used only to verify `X-Hub-Signature-256`.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: a new, long, random value that you create. Enter the exact same value in Meta's webhook configuration.
- `WHATSAPP_PHONE_NUMBER_ID`: the same sender Phone Number ID already used by the Cloud API send integration.

Do not prefix these with `VITE_`; none of these values belongs in browser code. Do not put actual secrets in GitHub, migrations, screenshots, or support messages.

In the Meta developer dashboard, configure the callback URL above, enter the verify token, complete the GET verification, and subscribe the WhatsApp Business Account to the `messages` webhook field. That field carries outbound status callbacks as well as inbound customer messages; this endpoint processes only the `statuses` array and deliberately ignores inbound message content.

The endpoint returns the Meta verification challenge only when the verify token matches. For POST events it validates the HMAC-SHA256 signature over the original raw request body using the App Secret. Missing configuration or invalid signatures fail closed. Delivery events are deduplicated and applied in provider-timestamp order; callbacks received before the browser saves the outbound message are retained and reconciled when its provider message ID is stored.

No messages are sent by webhook setup. Test with Meta's test tooling and confirm the callback in the Meta dashboard before relying on production delivery reporting.
