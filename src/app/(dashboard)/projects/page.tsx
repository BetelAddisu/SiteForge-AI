'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ExternalLink, MoreVertical, Trash2, Edit, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  businessName: string;
  industry: string;
  status: string;
  createdAt: string;
  wordpressUrl?: string;
}

// Fetch projects from API
async function getProjects(): Promise<Project[]> {
  try {
    const response = await fetch('/api/projects');
    if (response.ok) {
      const data = await response.json();
      return data.projects || [];
    }
  } catch (err) {
    console.error('Failed to fetch projects:', err);
  }
  return [];
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getProjects();
      setProjects(data);
      setLoading(false);
    }
    load();
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your website projects
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No projects yet</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Create your first project to generate a WordPress website with Elementor.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.businessName}</CardTitle>
                    <CardDescription className="capitalize">{project.industry}</CardDescription>
                  </div>
                  {getStatusBadge(project.status)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/projects/${project.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                  {project.wordpressUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={project.wordpressUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Visit
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Each project generates a complete WordPress website with Elementor. 
            After generation, you can edit the website directly in Elementor on your WordPress site.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
