import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Style Stealer - AI Website Style Guide Generator',
  description: 'Automatically generate comprehensive style guides from any website using AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
