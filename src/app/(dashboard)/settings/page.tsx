'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Key, 
  Globe, 
  Shield, 
  Check,
  AlertCircle,
  Save,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user, loading: authLoading, updateProfile } = useAuth();
  const router = useRouter();
  
  // Profile state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  
  // WordPress state
  const [wordpressUrl, setWordpressUrl] = useState('');
  const [wordpressUsername, setWordpressUsername] = useState('');
  const [wordpressAppPassword, setWordpressAppPassword] = useState('');
  const [wpConnected, setWpConnected] = useState(false);
  const [testingWp, setTestingWp] = useState(false);
  const [savingWp, setSavingWp] = useState(false);
  
  // API Keys state
  const [geminiKey, setGeminiKey] = useState('');
  const [unsplashKey, setUnsplashKey] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    
    if (user) {
      setName(user.name || '');
      setEmail(user.email);
      
      // Load saved settings
      loadSettings();
    }
  }, [user, authLoading, router]);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setWordpressUrl(data.settings.wordpressUrl || '');
          setWpConnected(!!data.settings.wordpressConnected);
        }
        if (data.apiKeys) {
          // Don't show actual keys, just indicate they exist
          setGeminiKey(data.apiKeys.gemini ? '••••••••••••' : '');
          setUnsplashKey(data.apiKeys.unsplash ? '••••••••••••' : '');
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const result = await updateProfile({ name, email });
    setSavingProfile(false);
    
    if (!result.error) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    }
  };

  const testWordPressConnection = async () => {
    setTestingWp(true);
    try {
      const response = await fetch('/api/integrations/wordpress/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: wordpressUrl, username: wordpressUsername, appPassword: wordpressAppPassword }),
      });
      
      if (response.ok) {
        setWpConnected(true);
        // Save the connection
        await fetch('/api/settings/wordpress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: wordpressUrl, username: wordpressUsername, appPassword: wordpressAppPassword }),
        });
      }
    } catch (err) {
      console.error('WordPress test failed:', err);
    } finally {
      setTestingWp(false);
    }
  };

  const handleSaveApiKeys = async () => {
    setSavingKeys(true);
    try {
      await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gemini: geminiKey !== '••••••••••••' ? geminiKey : undefined,
          unsplash: unsplashKey !== '••••••••••••' ? unsplashKey : undefined,
        }),
      });
    } catch (err) {
      console.error('Failed to save API keys:', err);
    } finally {
      setSavingKeys(false);
    }
  };

  if (authLoading) {
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
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your SiteForge AI account and integrations
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-4">
        <TabsList>
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="wordpress" className="gap-2">
            <Globe className="h-4 w-4" />
            WordPress
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
        </TabsList>

        {/* Account Settings */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Manage your account details and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  placeholder="Your name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="your@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if you need to update it.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : profileSaved ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WordPress Connection */}
        <TabsContent value="wordpress">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                WordPress Connection
              </CardTitle>
              <CardDescription>
                Connect your WordPress site to publish generated websites with Elementor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Connection Status */}
              <div className={cn(
                'flex items-center gap-3 rounded-lg border p-4',
                wpConnected ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'
              )}>
                {wpConnected ? (
                  <>
                    <Check className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Connected to WordPress</p>
                      <p className="text-sm text-green-600">{wordpressUrl}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-800">Not Connected</p>
                      <p className="text-sm text-yellow-600">Add your WordPress details below</p>
                    </div>
                  </>
                )}
              </div>

              {/* WordPress URL */}
              <div className="space-y-2">
                <Label htmlFor="wp-url">WordPress URL</Label>
                <Input 
                  id="wp-url" 
                  placeholder="https://yourwebsite.com"
                  value={wordpressUrl}
                  onChange={(e) => setWordpressUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The URL where your WordPress site is hosted.
                </p>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="wp-user">WordPress Username</Label>
                <Input 
                  id="wp-user" 
                  placeholder="admin"
                  value={wordpressUsername}
                  onChange={(e) => setWordpressUsername(e.target.value)}
                />
              </div>

              {/* Application Password */}
              <div className="space-y-2">
                <Label htmlFor="wp-pass">Application Password</Label>
                <Input 
                  id="wp-pass" 
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={wordpressAppPassword}
                  onChange={(e) => setWordpressAppPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Create an Application Password in WordPress → Users → Profile → Application Passwords.
                </p>
              </div>

              {/* Test Connection */}
              <Button 
                onClick={testWordPressConnection} 
                disabled={testingWp || !wordpressUrl || !wordpressUsername || !wordpressAppPassword}
              >
                {testingWp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Globe className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>

              {/* Help */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-medium">How to get an Application Password:</h4>
                <ol className="mt-2 space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Log into your WordPress admin dashboard</li>
                  <li>Go to Users → Profile (or Personal Settings)</li>
                  <li>Scroll to Application Passwords</li>
                  <li>Enter a name (e.g., "SiteForge AI") and click Generate</li>
                  <li>Copy the password and paste it above</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Configuration
              </CardTitle>
              <CardDescription>
                Configure your AI and external service API keys.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gemini">Google Gemini API Key</Label>
                <Input 
                  id="gemini" 
                  type="password"
                  placeholder={geminiKey || "Enter your API key"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Google AI Studio
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unsplash">Unsplash API Key</Label>
                <Input 
                  id="unsplash" 
                  type="password"
                  placeholder={unsplashKey || "Enter your API key"}
                  value={unsplashKey}
                  onChange={(e) => setUnsplashKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Unsplash Developers
                  </a>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Button onClick={handleSaveApiKeys} disabled={savingKeys}>
                  {savingKeys ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save API Keys
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                API keys are encrypted and stored securely.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
