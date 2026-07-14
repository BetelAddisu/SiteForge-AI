'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  Users,
  FileStack,
  Wand2,
  Globe,
  DollarSign,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  Settings,
} from 'lucide-react';

// ============================================================================
// Mock Data
// ============================================================================

const STATS = {
  totalProjects: 156,
  totalTemplates: 342,
  aiUsageToday: 452000,
  aiUsageLimit: 1000000,
  activeDeployments: 12,
  failedJobs: 3,
};

const RECENT_PROJECTS = [
  { id: '1', name: 'Acme Corp Website', status: 'GENERATING', owner: 'user1@example.com', lastActivity: '5 min ago' },
  { id: '2', name: 'TechStart Landing', status: 'PREVIEW', owner: 'user2@example.com', lastActivity: '1 hour ago' },
  { id: '3', name: 'Green Valley Landscaping', status: 'PUBLISHED', owner: 'user3@example.com', lastActivity: '2 hours ago' },
  { id: '4', name: 'Metro Restaurant', status: 'FAILED', owner: 'user4@example.com', lastActivity: '3 hours ago' },
  { id: '5', name: 'Summit Consulting', status: 'DRAFT', owner: 'user5@example.com', lastActivity: '1 day ago' },
];

const RECENT_AI_JOBS = [
  { id: '1', type: 'generateHomepage', status: 'COMPLETE', tokens: 12500, cost: 0.005, createdAt: '10 min ago' },
  { id: '2', type: 'generateAbout', status: 'PROCESSING', tokens: 4500, cost: null, createdAt: '5 min ago' },
  { id: '3', type: 'generateServices', status: 'FAILED', tokens: 8000, cost: null, createdAt: '30 min ago' },
  { id: '4', type: 'generateSEO', status: 'COMPLETE', tokens: 2500, cost: 0.001, createdAt: '1 hour ago' },
];

const TEMPLATE_STATS = [
  { category: 'Hero', count: 85, avgCompatibility: 92 },
  { category: 'About', count: 72, avgCompatibility: 88 },
  { category: 'Services', count: 94, avgCompatibility: 85 },
  { category: 'Pricing', count: 38, avgCompatibility: 78 },
  { category: 'Team', count: 28, avgCompatibility: 82 },
  { category: 'Testimonial', count: 25, avgCompatibility: 75 },
];

const DEPLOYMENTS = [
  { id: '1', project: 'TechStart Landing', url: 'https://techstart.com', status: 'LIVE', deployedAt: '2 hours ago' },
  { id: '2', project: 'Green Valley', url: 'https://greenvalley.com', status: 'LIVE', deployedAt: '1 day ago' },
  { id: '3', project: 'Metro Restaurant', url: 'https://metrorestaurant.com', status: 'ERROR', deployedAt: '3 days ago' },
];

// ============================================================================
// Components
// ============================================================================

function StatCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof BarChart3;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {trend && (
          <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
            <Activity className="h-3 w-3" />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    GENERATING: 'warning',
    PREVIEW: 'secondary',
    PUBLISHED: 'success',
    FAILED: 'destructive',
    DRAFT: 'outline',
    COMPLETE: 'success',
    PROCESSING: 'warning',
    PENDING: 'outline',
    LIVE: 'success',
    ERROR: 'destructive',
  };

  return (
    <Badge variant={variants[status.toLowerCase()] as any || 'outline'}>
      {status}
    </Badge>
  );
}

// ============================================================================
// Main Dashboard
// ============================================================================

export default function AdminDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            System overview and operations
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={STATS.totalProjects}
          subtitle="All time"
          icon={FileStack}
          trend="+12 this week"
        />
        <StatCard
          title="Templates"
          value={STATS.totalTemplates}
          subtitle="In library"
          icon={Database}
        />
        <StatCard
          title="AI Usage Today"
          value={(STATS.aiUsageToday / 1000).toFixed(0) + 'K'}
          subtitle="Tokens"
          icon={Wand2}
        />
        <StatCard
          title="Active Deployments"
          value={STATS.activeDeployments}
          subtitle="Live websites"
          icon={Globe}
        />
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="ai">AI Jobs</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* AI Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  AI Usage Today
                </CardTitle>
                <CardDescription>Token consumption by model</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Gemini 2.0 Flash</span>
                    <span className="text-muted-foreground">
                      {STATS.aiUsageToday.toLocaleString()} / {STATS.aiUsageLimit.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={(STATS.aiUsageToday / STATS.aiUsageLimit) * 100} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Estimated cost: ${(STATS.aiUsageToday / 1000000 * 0.10).toFixed(2)} today
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Database</span>
                  </div>
                  <Badge variant="success">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Supabase</span>
                  </div>
                  <Badge variant="success">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Failed Jobs</span>
                  </div>
                  <Badge variant="warning">{STATS.failedJobs}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { action: 'Template imported', detail: 'Modern Business Layout', time: '10 min ago', type: 'success' },
                    { action: 'AI generation failed', detail: 'About page for Project #42', time: '25 min ago', type: 'error' },
                    { action: 'Website deployed', detail: 'TechStart Landing Page', time: '2 hours ago', type: 'success' },
                    { action: 'Bulk import started', detail: '50 templates', time: '3 hours ago', type: 'info' },
                  ].map((activity, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`mt-1 h-2 w-2 rounded-full ${
                        activity.type === 'success' ? 'bg-green-500' :
                        activity.type === 'error' ? 'bg-red-500' :
                        'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">{activity.detail}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Projects</CardTitle>
              <CardDescription>Manage all user projects</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RECENT_PROJECTS.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell><StatusBadge status={project.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{project.owner}</TableCell>
                      <TableCell className="text-muted-foreground">{project.lastActivity}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Jobs Tab */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Job Queue</CardTitle>
                  <CardDescription>Monitor AI generation jobs</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RECENT_AI_JOBS.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">#{job.id}</TableCell>
                      <TableCell>{job.type}</TableCell>
                      <TableCell><StatusBadge status={job.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{job.tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.cost !== null ? `$${job.cost.toFixed(4)}` : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{job.createdAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Library</CardTitle>
              <CardDescription>Template statistics by category</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Avg. Compatibility</TableHead>
                    <TableHead>Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TEMPLATE_STATS.map((stat) => (
                    <TableRow key={stat.category}>
                      <TableCell className="font-medium">{stat.category}</TableCell>
                      <TableCell>{stat.count}</TableCell>
                      <TableCell className="text-muted-foreground">{stat.avgCompatibility}%</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={stat.avgCompatibility} className="w-16" />
                          {stat.avgCompatibility >= 80 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deployments Tab */}
        <TabsContent value="deployments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WordPress Deployments</CardTitle>
              <CardDescription>Published websites and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deployed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DEPLOYMENTS.map((deployment) => (
                    <TableRow key={deployment.id}>
                      <TableCell className="font-medium">{deployment.project}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {deployment.url}
                      </TableCell>
                      <TableCell><StatusBadge status={deployment.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{deployment.deployedAt}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
