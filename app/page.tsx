'use client';

import { useState } from 'react';
import type { GenerateResponse } from '@/lib/types';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setGenerationTime(null);

    try {
      // Progress messages
      setProgress('Fetching website...');

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data: GenerateResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate style guide');
      }

      setProgress('Analyzing styles...');
      await new Promise((resolve) => setTimeout(resolve, 300));

      setProgress('Analyzing images...');
      await new Promise((resolve) => setTimeout(resolve, 300));

      setProgress('Generating guide...');
      await new Promise((resolve) => setTimeout(resolve, 300));

      setResult(data.markdown || '');
      setGenerationTime(data.generationTime || null);
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;

    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'style-guide.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!result) return;

    navigator.clipboard.writeText(result);
    alert('Copied to clipboard!');
  };

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Style Stealer
          </h1>
          <p className="text-lg text-gray-600">
            Generate comprehensive style guides from any website using AI
          </p>
        </div>

        {/* Input Form */}
        <div className="card mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                Website URL
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="input"
                disabled={loading}
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter any public website URL to analyze its design system
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {progress || 'Processing...'}
                </span>
              ) : (
                'Generate Style Guide'
              )}
            </button>
          </form>

          {/* Examples */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {['https://stripe.com', 'https://github.com', 'https://airbnb.com'].map((exampleUrl) => (
                <button
                  key={exampleUrl}
                  onClick={() => setUrl(exampleUrl)}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50"
                >
                  {exampleUrl.replace('https://', '')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="card bg-red-50 border-red-200 mb-8">
            <div className="flex items-start">
              <svg
                className="h-5 w-5 text-red-600 mt-0.5 mr-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Generated Style Guide</h2>
                {generationTime && (
                  <p className="text-sm text-gray-500 mt-1">
                    Generated in {(generationTime / 1000).toFixed(2)}s
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="bg-gray-50 rounded-lg p-6 max-h-[600px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {result}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            Powered by Claude AI • Built with Next.js
          </p>
        </div>
      </div>
    </main>
  );
}
