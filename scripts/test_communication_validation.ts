/**
 * Automated Verification: Strict Communication Provider Credential Validation
 * Tests that missing or incomplete provider credentials throw descriptive errors
 * before attempting message dispatch.
 */

import {
  validateEmailProviderCredentials,
  validateWhatsAppProviderCredentials,
  validateProviderCredentials,
  sendEmailMessage,
  sendWhatsAppMessage,
  ProviderConfigurationError,
  saveProviderConfig,
  getProviderConfig,
  DEFAULT_PROVIDER_CONFIG,
} from '../src/services/communicationService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  Communication Provider Credential Validation Test Suite');
  console.log('================================================================\n');

  // Test 1: Email provider set to 'none' throws ProviderConfigurationError
  console.log('Test 1: Unconfigured Email Provider Rejection');
  let err1: any = null;
  try {
    validateEmailProviderCredentials({
      provider: 'none',
      isConfigured: false,
    });
  } catch (err: any) {
    err1 = err;
  }
  assert(err1 instanceof ProviderConfigurationError, 'Throws ProviderConfigurationError when email provider is "none"');
  assert(err1?.message.includes('Email provider is not configured'), `Error message is descriptive: "${err1?.message}"`);

  // Test 2: Email provider with missing apiKey
  console.log('\nTest 2: Email Provider Missing API Key');
  let err2: any = null;
  try {
    validateEmailProviderCredentials({
      provider: 'resend',
      apiKey: '',
      fromEmail: 'info@redseavoyages.com',
      isConfigured: false,
    });
  } catch (err: any) {
    err2 = err;
  }
  assert(err2 instanceof ProviderConfigurationError, 'Throws ProviderConfigurationError when apiKey is missing');
  assert(err2?.message.includes('apiKey'), `Error message highlights missing apiKey: "${err2?.message}"`);

  // Test 3: Email provider with invalid fromEmail
  console.log('\nTest 3: Email Provider Missing/Invalid From Address');
  let err3: any = null;
  try {
    validateEmailProviderCredentials({
      provider: 'sendgrid',
      apiKey: 'SG.1234567890abcdef',
      fromEmail: 'invalid-email-address',
      isConfigured: false,
    });
  } catch (err: any) {
    err3 = err;
  }
  assert(err3 instanceof ProviderConfigurationError, 'Throws ProviderConfigurationError when fromEmail is invalid');
  assert(err3?.message.includes('fromEmail'), `Error message highlights invalid fromEmail: "${err3?.message}"`);

  // Test 4: WhatsApp provider set to 'none'
  console.log('\nTest 4: Unconfigured WhatsApp Provider Rejection');
  let err4: any = null;
  try {
    validateWhatsAppProviderCredentials({
      provider: 'none',
      isConfigured: false,
    });
  } catch (err: any) {
    err4 = err;
  }
  assert(err4 instanceof ProviderConfigurationError, 'Throws ProviderConfigurationError when WhatsApp provider is "none"');
  assert(err4?.message.includes('WhatsApp provider is not configured'), `Error message is descriptive: "${err4?.message}"`);

  // Test 5: Meta Cloud API missing phoneNumberId
  console.log('\nTest 5: Meta Cloud API Missing phoneNumberId');
  let err5: any = null;
  try {
    validateWhatsAppProviderCredentials({
      provider: 'meta_cloud',
      apiKey: 'EAABwz1234567890abcdef',
      phoneNumberId: '',
      isConfigured: false,
    });
  } catch (err: any) {
    err5 = err;
  }
  assert(err5 instanceof ProviderConfigurationError, 'Throws ProviderConfigurationError when Meta Cloud phoneNumberId is missing');
  assert(err5?.message.includes('phoneNumberId'), `Error message highlights missing phoneNumberId: "${err5?.message}"`);

  // Test 6: Twilio missing fromNumber
  console.log('\nTest 6: Twilio Missing fromNumber');
  let err6: any = null;
  try {
    validateWhatsAppProviderCredentials({
      provider: 'twilio',
      apiKey: 'AC1234567890abcdef12345',
      fromNumber: '',
      isConfigured: false,
    });
  } catch (err: any) {
    err6 = err;
  }
  assert(err6 instanceof ProviderConfigurationError, 'Throws ProviderConfigurationError when Twilio fromNumber is missing');
  assert(err6?.message.includes('fromNumber'), `Error message highlights missing fromNumber: "${err6?.message}"`);

  // Test 7: Universal validateProviderCredentials helper
  console.log('\nTest 7: Universal validateProviderCredentials Helper');
  let err7: any = null;
  try {
    validateProviderCredentials('Email', {
      ...DEFAULT_PROVIDER_CONFIG,
      email: { provider: 'none', isConfigured: false },
    });
  } catch (err: any) {
    err7 = err;
  }
  assert(err7 instanceof ProviderConfigurationError, 'Universal validator dispatches to channel validator');

  // Test 8: sendEmailMessage throws descriptive error before dispatch when unconfigured
  console.log('\nTest 8: sendEmailMessage Throws On Missing Credentials');
  saveProviderConfig(DEFAULT_PROVIDER_CONFIG);
  let err8: any = null;
  try {
    await sendEmailMessage({
      recipientEmail: 'guest@example.com',
      customerName: 'Guest Tester',
      subject: 'Test Subject',
      content: 'Test message body',
    });
  } catch (err: any) {
    err8 = err;
  }
  assert(err8 instanceof ProviderConfigurationError, 'sendEmailMessage strictly throws ProviderConfigurationError');
  assert(err8?.message.includes('Email provider is not configured'), `sendEmailMessage threw descriptive error: "${err8?.message}"`);

  // Test 9: sendWhatsAppMessage throws descriptive error before dispatch when unconfigured
  console.log('\nTest 9: sendWhatsAppMessage Throws On Missing Credentials');
  let err9: any = null;
  try {
    await sendWhatsAppMessage({
      recipientPhone: '+201004567890',
      customerName: 'Guest Tester',
      content: 'Test WhatsApp message',
    });
  } catch (err: any) {
    err9 = err;
  }
  assert(err9 instanceof ProviderConfigurationError, 'sendWhatsAppMessage strictly throws ProviderConfigurationError');
  assert(err9?.message.includes('WhatsApp provider is not configured'), `sendWhatsAppMessage threw descriptive error: "${err9?.message}"`);

  // Test 10: Valid credentials pass without throwing
  console.log('\nTest 10: Valid Credentials Pass Validation');
  let passEmail = false;
  try {
    validateEmailProviderCredentials({
      provider: 'resend',
      apiKey: 're_1234567890abcdef',
      fromEmail: 'concierge@redseavoyages.com',
      isConfigured: true,
    });
    passEmail = true;
  } catch {
    passEmail = false;
  }
  assert(passEmail, 'Valid Email provider configuration passes validation without error');

  let passWhatsApp = false;
  try {
    validateWhatsAppProviderCredentials({
      provider: 'meta_cloud',
      apiKey: 'EAABwz1234567890abcdef',
      phoneNumberId: '1029384756',
      isConfigured: true,
    });
    passWhatsApp = true;
  } catch {
    passWhatsApp = false;
  }
  // Test 11: sendWhatsAppMessage surfacing specific missing phoneNumberId on Meta Cloud
  console.log('\nTest 11: sendWhatsAppMessage Surfacing Meta Cloud Missing phoneNumberId');
  saveProviderConfig({
    ...DEFAULT_PROVIDER_CONFIG,
    whatsapp: {
      provider: 'meta_cloud',
      apiKey: 'EAABwz1234567890abcdef',
      phoneNumberId: '',
      isConfigured: false,
    },
  });
  let err11: any = null;
  try {
    await sendWhatsAppMessage({
      recipientPhone: '+201004567890',
      customerName: 'Guest Tester',
      content: 'Test WhatsApp message for Meta Cloud',
    });
  } catch (err: any) {
    err11 = err;
  }
  assert(err11 instanceof ProviderConfigurationError, 'Throws ProviderConfigurationError for Meta Cloud missing phoneNumberId');
  assert(
    Array.isArray(err11?.missingFields) && err11.missingFields.some((f: string) => f.includes('phoneNumberId')),
    `missingFields array contains phoneNumberId: "${err11?.missingFields?.join(', ')}"`
  );
  assert(
    err11?.message.includes('phoneNumberId'),
    `Error message explicitly specifies missing phoneNumberId: "${err11?.message}"`
  );

  // Test 12: sendWhatsAppMessage surfacing specific missing fromNumber on Twilio
  console.log('\nTest 12: sendWhatsAppMessage Surfacing Twilio Missing fromNumber');
  saveProviderConfig({
    ...DEFAULT_PROVIDER_CONFIG,
    whatsapp: {
      provider: 'twilio',
      apiKey: 'AC1234567890abcdef12345',
      fromNumber: '',
      isConfigured: false,
    },
  });
  let err12: any = null;
  try {
    await sendWhatsAppMessage({
      recipientPhone: '+201004567890',
      customerName: 'Guest Tester',
      content: 'Test WhatsApp message for Twilio',
    });
  } catch (err: any) {
    err12 = err;
  }
  assert(err12 instanceof ProviderConfigurationError, 'Throws ProviderConfigurationError for Twilio missing fromNumber');
  assert(
    Array.isArray(err12?.missingFields) && err12.missingFields.some((f: string) => f.includes('fromNumber')),
    `missingFields array contains fromNumber: "${err12?.missingFields?.join(', ')}"`
  );
  assert(
    err12?.message.includes('fromNumber'),
    `Error message explicitly specifies missing fromNumber: "${err12?.message}"`
  );

  // Reset provider config back to default
  saveProviderConfig(DEFAULT_PROVIDER_CONFIG);

  console.log('\n================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
