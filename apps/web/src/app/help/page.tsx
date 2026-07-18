import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help & Documentation</h1>
        <p className="text-muted-foreground">Learn how to customize and extend your desk</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Adding New Pages</CardTitle>
            <CardDescription>Create pages in the App Router</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Create a new folder in <code className="bg-muted px-1 rounded">src/app/</code> with a{' '}
              <code className="bg-muted px-1 rounded">page.tsx</code> file.
            </p>
            <p>
              Add a <code className="bg-muted px-1 rounded">layout.tsx</code> that wraps content with{' '}
              <code className="bg-muted px-1 rounded">AppShell</code> for the sidebar.
            </p>
            <p>
              Update navigation in <code className="bg-muted px-1 rounded">app-sidebar.tsx</code> to include your new
              page.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adding API Routes</CardTitle>
            <CardDescription>Create backend proxy endpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Create route handlers in <code className="bg-muted px-1 rounded">src/app/api/</code>.
            </p>
            <p>
              Use <code className="bg-muted px-1 rounded">getSession()</code> from{' '}
              <code className="bg-muted px-1 rounded">lib/auth.ts</code> to verify authentication.
            </p>
            <p>Proxy requests to your backend API with the user&apos;s session token.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Using Auth Desk integration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Authentication is handled automatically via Auth Desk at{' '}
              <code className="bg-muted px-1 rounded">mumzdesk.dev</code>.
            </p>
            <p>
              Use <code className="bg-muted px-1 rounded">getSession()</code> in server components to get the current
              user.
            </p>
            <p>The middleware protects all routes and redirects unauthenticated users.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permission Gates</CardTitle>
            <CardDescription>Role-based access control</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Wrap components with <code className="bg-muted px-1 rounded">PermissionGate</code> to restrict by role.
            </p>
            <p>Available roles from Auth Desk: admin, editor, viewer.</p>
            <p>
              Pass your <code className="bg-muted px-1 rounded">deskSlug</code> prop to check permissions for this desk.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UI Components</CardTitle>
            <CardDescription>shadcn/ui component library</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Components are in <code className="bg-muted px-1 rounded">src/components/ui/</code>.
            </p>
            <p>
              Add more components with: <code className="bg-muted px-1 rounded">npx shadcn@latest add [component]</code>
            </p>
            <p>
              Browse available components at{' '}
              <a
                href="https://ui.shadcn.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                ui.shadcn.com
              </a>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>Required configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <code className="bg-muted px-1 rounded">DESK_SLUG</code> - Your desk identifier in Auth Desk
            </p>
            <p>
              <code className="bg-muted px-1 rounded">NEXT_PUBLIC_DESK_NAME</code> - Display name in the UI
            </p>
            <p>
              <code className="bg-muted px-1 rounded">NEXTAUTH_URL</code> - Your desk&apos;s public URL
            </p>
            <p>
              See <code className="bg-muted px-1 rounded">env.example</code> for all options.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local Development (Solo Mode)</CardTitle>
            <CardDescription>Bypass authentication for faster development</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Set <code className="bg-muted px-1 rounded">AUTH_BYPASS=true</code> in your{' '}
              <code className="bg-muted px-1 rounded">.env.local</code> to skip authentication during local development.
            </p>
            <p>
              This enables &quot;solo mode&quot; where you can develop without Auth Desk integration. A mock user
              session is provided automatically.
            </p>
            <p className="text-amber-600 dark:text-amber-400 font-medium">
              This only works when <code className="bg-muted px-1 rounded">NODE_ENV=development</code>. Production
              builds always require authentication.
            </p>
            <p>
              Check your current auth mode on the{' '}
              <a href="/settings" className="text-primary underline">
                Settings page
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
