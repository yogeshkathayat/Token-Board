'use client';

import { Check, Copy, Download, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LinkCodeResponse {
  code: string;
  expires_at: string;
}

export function SettingsClient() {
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<{ code?: boolean; command?: boolean }>({});
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        setLinkCode(null);
        setExpiresAt(null);
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const generateLinkCode = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/link-code/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to generate link code');
      }

      const data: LinkCodeResponse = await response.json();
      setLinkCode(data.code);
      setExpiresAt(new Date(data.expires_at));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, key: 'code' | 'command') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ ...copied, [key]: true });
      setTimeout(() => setCopied({ ...copied, [key]: false }), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const cliCommand = linkCode
    ? `tokenboard init --link-code ${linkCode} --base-url ${baseUrl}`
    : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Connect a Device</h1>
        <p className="text-muted-foreground">Link the TokenBoard CLI to sync your local token usage</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Install the CLI</CardTitle>
          <CardDescription>First, install the TokenBoard CLI globally using npm</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <code className="text-sm">npm install -g tokenboard-cli</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard('npm install -g tokenboard-cli', 'command')}
              >
                {copied.command ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            This installs the <code className="rounded bg-muted px-1 py-0.5">tokenboard</code> command globally on your system.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate Link Code</CardTitle>
          <CardDescription>Create a temporary code to authenticate your CLI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!linkCode ? (
            <Button onClick={generateLinkCode} disabled={isGenerating} className="w-full sm:w-auto">
              <Terminal className="mr-2 h-4 w-4" />
              {isGenerating ? 'Generating...' : 'Generate Link Code'}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Your Link Code</p>
                  <div className="flex items-center gap-2">
                    <p className="text-4xl font-bold tracking-wider">{linkCode}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(linkCode, 'code')}
                    >
                      {copied.code ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Expires in: <span className="font-mono font-medium">{timeRemaining}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Run this command in your terminal:</p>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <code className="break-all text-sm">{cliCommand}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copyToClipboard(cliCommand, 'command')}
                    >
                      {copied.command ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Button variant="outline" onClick={generateLinkCode} className="w-full sm:w-auto">
                Generate New Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What Happens Next?</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                1
              </span>
              <span>The CLI will authenticate with your account using the link code</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                2
              </span>
              <span>It will scan your local AI tool logs (Claude, Cursor, etc.)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                3
              </span>
              <span>Run <code className="rounded bg-muted px-1 py-0.5">tokenboard sync</code> to upload your usage data</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                4
              </span>
              <span>Your token usage will appear on your dashboard and the company leaderboard</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>What data is collected</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            TokenBoard only collects <strong>token counts</strong> and <strong>timestamps</strong>. No prompts, responses, file contents, or filenames are ever uploaded. All data stays within your company.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
