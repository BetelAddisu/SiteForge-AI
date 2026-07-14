import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileStack, 
  FolderOpen, 
  Wand2, 
  TrendingUp,
  Zap,
  Globe,
  Clock
} from 'lucide-react';
import Link from 'next/link';

const stats = [
  {
    title: 'Templates',
    value: '342',
    description: 'Total templates in library',
    icon: FileStack,
    trend: '+12 this week',
  },
  {
    title: 'Projects',
    value: '28',
    description: 'Active projects',
    icon: FolderOpen,
    trend: '5 in progress',
  },
  {
    title: 'AI Generations',
    value: '156',
    description: 'This month',
    icon: Wand2,
    trend: '+23% from last month',
  },
  {
    title: 'Deployments',
    value: '12',
    description: 'Live websites',
    icon: Globe,
    trend: 'All healthy',
  },
];

const recentProjects = [
  {
    id: '1',
    name: 'Acme Corp Website',
    status: 'generating',
    progress: 65,
    lastActivity: '2 hours ago',
  },
  {
    id: '2',
    name: 'TechStart Landing Page',
    status: 'preview',
    progress: 100,
    lastActivity: '5 hours ago',
  },
  {
    id: '3',
    name: 'Green Valley Landscaping',
    status: 'draft',
    progress: 25,
    lastActivity: '1 day ago',
  },
];

const aiUsageToday = [
  { label: 'Content Generation', usage: 45000, limit: 100000, unit: 'tokens' },
  { label: 'Template Matching', usage: 12000, limit: 50000, unit: 'calls' },
  { label: 'Image Alt Text', usage: 8500, limit: 20000, unit: 'images' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening with your projects.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
              <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                <TrendingUp className="h-3 w-3" />
                {stat.trend}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
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
          <CardContent className="space-y-4">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">{project.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {project.lastActivity}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      project.status === 'preview'
                        ? 'success'
                        : project.status === 'generating'
                        ? 'warning'
                        : 'secondary'
                    }
                  >
                    {project.status}
                  </Badge>
                  <div className="w-16 text-right">
                    <span className="text-xs font-medium">{project.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Usage */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>AI Usage Today</CardTitle>
                <CardDescription>Resource consumption</CardDescription>
              </div>
              <Badge variant="outline" className="font-normal">
                <Zap className="mr-1 h-3 w-3" />
                Gemini 2.0 Flash
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {aiUsageToday.map((metric) => (
              <div key={metric.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{metric.label}</span>
                  <span className="text-muted-foreground">
                    {metric.usage.toLocaleString()} / {metric.limit.toLocaleString()} {metric.unit}
                  </span>
                </div>
                <Progress value={(metric.usage / metric.limit) * 100} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button className="w-full justify-start" asChild>
              <Link href="/generator">
                <Wand2 className="mr-2 h-4 w-4" />
                Generate New Website
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/templates">
                <FileStack className="mr-2 h-4 w-4" />
                Browse Templates
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/projects/new">
                <FolderOpen className="mr-2 h-4 w-4" />
                Create New Project
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: 'Template imported', detail: 'Modern Business Layout', time: '10 min ago' },
                { action: 'AI generation complete', detail: 'Homepage content for TechStart', time: '2 hours ago' },
                { action: 'Project created', detail: 'Green Valley Landscaping', time: '1 day ago' },
                { action: 'Website deployed', detail: 'TechStart Landing Page', time: '2 days ago' },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-muted-foreground">{activity.detail}</p>
                  </div>
                  <span className="text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
