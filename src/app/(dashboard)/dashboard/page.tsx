'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileStack, 
  FolderOpen, 
  Wand2, 
  Globe,
  Clock,
  Plus,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface DashboardStats {
  templates: number;
  projects: number;
  deployments: number;
}

interface Project {
  id: string;
  businessName: string;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ templates: 0, projects: 0, deployments: 0 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch templates count
        const templatesRes = await fetch('/api/templates');
        const templatesData = await templatesRes.json();
        
        // Fetch projects count
        const projectsRes = await fetch('/api/projects');
        const projectsData = await projectsRes.json();
        
        setStats({
          templates: templatesData.templates?.length || 0,
          projects: projectsData.projects?.length || 0,
          deployments: projectsData.projects?.filter((p: Project) => p.status === 'published').length || 0,
        });
        
        setProjects(projectsData.projects?.slice(0, 5) || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'secondary' | 'default' | 'destructive' | 'success'> = {
      draft: 'secondary',
      generating: 'default',
      preview: 'default',
      published: 'success',
      failed: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your WordPress website projects
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.templates}</div>
            <p className="text-xs text-muted-foreground">
              Elementor templates in library
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.projects}</div>
            <p className="text-xs text-muted-foreground">
              Website projects created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployments</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.deployments}</div>
            <p className="text-xs text-muted-foreground">
              Published to WordPress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Your latest website projects</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/projects">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No projects yet. Create your first WordPress website!
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/projects/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Project
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{project.businessName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(project.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with your next project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" asChild>
              <Link href="/projects/new">
                <Wand2 className="mr-2 h-4 w-4" />
                Create New Project
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/templates">
                <FileStack className="mr-2 h-4 w-4" />
                Browse Templates
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/generator">
                <Wand2 className="mr-2 h-4 w-4" />
                View Generator
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Getting Started */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Getting Started with WordPress</CardTitle>
            <CardDescription>
              Follow these steps to publish your first website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className={cn(
                'flex flex-col items-center text-center rounded-lg border p-4',
              )}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-lg font-bold">1</span>
                </div>
                <h4 className="mt-3 font-semibold">Create Project</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tell us about your business
                </p>
              </div>
              <div className="flex flex-col items-center text-center rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-lg font-bold">2</span>
                </div>
                <h4 className="mt-3 font-semibold">Select Template</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose from 700+ Elementor templates
                </p>
              </div>
              <div className="flex flex-col items-center text-center rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-lg font-bold">3</span>
                </div>
                <h4 className="mt-3 font-semibold">Generate Content</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  AI creates professional copy
                </p>
              </div>
              <div className="flex flex-col items-center text-center rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <span className="text-lg font-bold">4</span>
                </div>
                <h4 className="mt-3 font-semibold">Publish</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Deploy directly to WordPress
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
                <div className="text-sm text-blue-800">
                  <strong>Note:</strong> Before publishing, connect your WordPress site in{' '}
                  <Link href="/settings" className="font-medium underline">Settings</Link>.
                  You'll need Elementor installed and an Application Password.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
