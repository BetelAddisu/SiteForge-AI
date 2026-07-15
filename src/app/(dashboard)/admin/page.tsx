'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  FolderOpen, 
  FileStack, 
  Globe,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

interface AdminStats {
  users: number;
  projects: number;
  templates: number;
  deployments: number;
}

interface SystemStatus {
  database: { connected: boolean; error: string | null };
  supabaseStorage: { connected: boolean; error: string | null; bucketExists: boolean };
  geminiApi: { configured: boolean };
  unsplashApi: { configured: boolean };
  wordpress: { configured: boolean };
  healthy: boolean;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({ users: 0, projects: 0, templates: 0, deployments: 0 });
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    async function loadStats() {
      try {
        // Load all stats in parallel
        const [usersRes, projectsRes, templatesRes, statusRes] = await Promise.all([
          fetch('/api/admin/users/count'),
          fetch('/api/projects'),
          fetch('/api/templates?refresh=true'),
          fetch('/api/admin/status'),
        ]);

        let userCount = 0;
        let projectCount = 0;
        let deploymentCount = 0;

        if (usersRes.ok) {
          const data = await usersRes.json();
          userCount = data.count || 0;
        }

        if (projectsRes.ok) {
          const data = await projectsRes.json();
          projectCount = data.projects?.length || 0;
          deploymentCount = data.projects?.filter((p: { status: string }) => p.status === 'PUBLISHED').length || 0;
        }

        let templateCount = 0;
        if (templatesRes.ok) {
          const data = await templatesRes.json();
          templateCount = data.templates?.length || 0;
        }

        setStats({
          users: userCount,
          projects: projectCount,
          templates: templateCount,
          deployments: deploymentCount,
        });

        // Load system status
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setStatus(statusData);
        }
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadStats();
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor system health and usage metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users}</div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.projects}</div>
            <p className="text-xs text-muted-foreground">
              Website projects created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.templates}</div>
            <p className="text-xs text-muted-foreground">
              Elementor templates in library
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployments</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deployments}</div>
            <p className="text-xs text-muted-foreground">
              Published to WordPress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
            {status?.healthy ? (
              <Badge variant="success" className="ml-2">All Systems Operational</Badge>
            ) : (
              <Badge variant="destructive" className="ml-2">Issues Detected</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Current state of SiteForge AI services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Database */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {status?.database?.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">Database</p>
                  <p className="text-sm text-muted-foreground">
                    {status?.database?.connected 
                      ? 'Connected to Supabase' 
                      : status?.database?.error || 'Connection failed'}
                  </p>
                </div>
              </div>
              <Badge variant={status?.database?.connected ? 'success' : 'destructive'}>
                {status?.database?.connected ? 'Operational' : 'Error'}
              </Badge>
            </div>

            {/* Supabase Storage */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {status?.supabaseStorage?.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">Supabase Storage</p>
                  <p className="text-sm text-muted-foreground">
                    {status?.supabaseStorage?.connected 
                      ? status?.supabaseStorage?.bucketExists 
                        ? 'Template bucket accessible'
                        : 'Buckets accessible (no templates bucket)'
                      : status?.supabaseStorage?.error || 'Connection failed'}
                  </p>
                </div>
              </div>
              <Badge variant={status?.supabaseStorage?.connected ? 'success' : 'destructive'}>
                {status?.supabaseStorage?.connected ? 'Operational' : 'Error'}
              </Badge>
            </div>

            {/* AI Service */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {status?.geminiApi?.configured ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <div>
                  <p className="font-medium">AI Service</p>
                  <p className="text-sm text-muted-foreground">
                    {status?.geminiApi?.configured 
                      ? 'Gemini API configured' 
                      : 'Gemini API key not configured'}
                  </p>
                </div>
              </div>
              <Badge variant={status?.geminiApi?.configured ? 'success' : 'secondary'}>
                {status?.geminiApi?.configured ? 'Configured' : 'Not Set'}
              </Badge>
            </div>

            {/* Stock Images */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {status?.unsplashApi?.configured ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <div>
                  <p className="font-medium">Stock Images</p>
                  <p className="text-sm text-muted-foreground">
                    {status?.unsplashApi?.configured 
                      ? 'Unsplash API configured' 
                      : 'Unsplash API key not configured'}
                  </p>
                </div>
              </div>
              <Badge variant={status?.unsplashApi?.configured ? 'success' : 'secondary'}>
                {status?.unsplashApi?.configured ? 'Configured' : 'Not Set'}
              </Badge>
            </div>

            {/* WordPress */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {status?.wordpress?.configured ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <div>
                  <p className="font-medium">WordPress Integration</p>
                  <p className="text-sm text-muted-foreground">
                    {status?.wordpress?.configured 
                      ? 'WordPress credentials configured' 
                      : 'Not configured (add in Settings)'}
                  </p>
                </div>
              </div>
              <Badge variant={status?.wordpress?.configured ? 'success' : 'secondary'}>
                {status?.wordpress?.configured ? 'Configured' : 'Not Set'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">
            <strong>Admin Note:</strong> This dashboard shows real-time metrics from your database. 
            For production deployments, ensure all environment variables are configured in Vercel 
            or your hosting provider.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
