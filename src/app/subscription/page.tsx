import type { Metadata } from 'next';
import Script from 'next/script';
import SubscriptionPageClient from '@/components/subscription/SubscriptionPageClient';

export const metadata: Metadata = {
  title: 'Subscription Plans | Railjee',
  description: 'Choose a department and subscription duration to unlock Railjee premium papers.',
};

export default function SubscriptionPage() {
  return (
    <>
      {/* Razorpay SDK — only needed on this page */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <SubscriptionPageClient />
    </>
  );
}
