// ============================================================================
// CONFIG - Supabase credentials na settings za jumla
// ============================================================================

export const SUPABASE_URL = 'https://whexrklnrkigfqpdfzbt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZXhya2xucmtpZ2ZxcGRmemJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNTM0OTMsImV4cCI6MjA5MzYyOTQ5M30.H0vvFqp-8zlltb0KoLpCQfNR0dudk86qrRO8ZSjLju0';

// BATALIZA AGROBUSINESS brand colors
export const COLORS = {
  green: '#22C55E',
  greenDark: '#15803D',
  greenDarker: '#14532D',
  greenLight: '#DCFCE7',
  greenLighter: '#F0FDF4',
  white: '#FFFFFF',
  text: '#14532D',
  textLight: '#15803D',
  border: '#BBF7D0'
};

// Currency formatter
export const formatTZS = (amount) => {
  if (amount === null || amount === undefined) return 'TZS 0';
  return 'TZS ' + Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
};

// Date formatter
export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('sw-TZ', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

// Settings za jumla
export const APP_CONFIG = {
  appName: 'BATALIZA AGROBUSINESS',
  companyName: 'BATALIZA AGROBUSINESS',
  pageSize: 25,
  alertThreshold: 90,
  currency: 'TZS',
  timezone: 'Africa/Dar_es_Salaam'
};
