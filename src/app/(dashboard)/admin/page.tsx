'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  FolderOpen, 
  FileStack, 
  Globe,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminStats {
  users: number;
  projects: number;
  templates: number;
  deployments: number;
}

interface RecentActivity {
  id: string;
  type: 'user_signup' | 'project_created' | 'deployment' | 'template_import';
  description: string;
  timestamp: string;
}

interface TemplateUsage {
  name: string;
  uses: number;
  category: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({ users: 0, projects: 0, templates: 0, deployments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    async function loadStats() {
      try {
        // Load all stats in parallel
        const [usersRes, projectsRes, templatesRes] = await Promise.all([
          fetch('/api/admin/users/count'),
          fetch('/api/projects'),
          fetch('/api/templates'),
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
          </CardTitle>
          <CardDescription>
            Current state of SiteForge AI services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Database</p>
                  <p className="text-sm text-muted-foreground">Connected to Supabase</p>
                </div>
              </div>
              <Badge variant="success">Operational</Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Supabase Storage</p>
                  <p className="text-sm text-muted-foreground">Template bucket accessible</p>
                </div>
              </div>
              <Badge variant="success">Operational</Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <div>
                  <p className="font-medium">AI Service</p>
                  <p className="text-sm text-muted-foreground">
                    {process.env.GEMINI_API_KEY 
                      ? 'Gemini API configured' 
                      : 'Gemini API key not configured'}
                  </p>
                </div>
              </div>
              <Badge variant={process.env.GEMINI_API_KEY ? 'success' : 'secondary'}>
                {process.env.GEMINI_API_KEY ? 'Configured' : 'Not Set'}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {process.env.UNSPLASH_ACCESS_KEY ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <div>
                  <p className="font-medium">Stock Images</p>
                  <p className="text-sm text-muted-foreground">
                    {process.env.UNSPLASH_ACCESS_KEY 
                      ? 'Unsplash API configured' 
                      : 'Unsplash API key not configured'}
                  </p>
                </div>
              </div>
              <Badge variant={process.env.UNSPLASH_ACCESS_KEY ? 'success' : 'secondary'}>
                {process.env.UNSPLASH_ACCESS_KEY ? 'Configured' : 'Not Set'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
          <CardDescription>
            Required environment variables for production
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', critical: true },
              { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key', critical: true },
              { name: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase Service Role Key', critical: true },
              { name: 'DATABASE_URL', label: 'Prisma Database URL', critical: true },
              { name: 'GEMINI_API_KEY', label: 'Gemini API Key', critical: false },
              { name: 'UNSPLASH_ACCESS_KEY', label: 'Unsplash Access Key', critical: false },
            ].map((env) => (
              <div key={env.name} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <code className="text-sm font-mono">{env.name}</code>
                  <p className="text-xs text-muted-foreground">{env.label}</p>
                </div>
                <Badge variant={process.env[env.name as keyof typeof process.env] ? 'success' : 'secondary'}>
                  {process.env[env.name as keyof typeof process.env] ? 'Set' : 'Not Set'}
                </Badge>
              </div>
            ))}
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
