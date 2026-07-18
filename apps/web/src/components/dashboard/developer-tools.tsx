'use client';

import { Bot, Plug, Zap } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface Agent {
  name: string;
  description: string;
}

export interface Skill {
  name: string;
  description: string;
  triggerCommand: string;
}

interface MCPPlugin {
  name: string;
  description: string;
  installCommand: string;
}

export interface DeveloperToolsProps {
  agents: Agent[];
  skills: Skill[];
  loading?: boolean;
}

const mcpPlugins: MCPPlugin[] = [
  {
    name: 'Context7',
    description: 'Library documentation lookup',
    installCommand: 'mcp install context7',
  },
  {
    name: 'Chrome DevTools',
    description: 'Browser automation and debugging',
    installCommand: 'mcp install anthropic/puppeteer',
  },
];

function AgentCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 mt-2" />
      </CardContent>
    </Card>
  );
}

function SkillCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3 mt-2" />
      </CardContent>
    </Card>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-5 w-5 text-muted-foreground" />
          {agent.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{agent.description}</p>
      </CardContent>
    </Card>
  );
}

function SkillCard({ skill }: { skill: Skill }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-muted-foreground" />
            {skill.name}
          </CardTitle>
          <Badge variant="secondary">{skill.triggerCommand}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{skill.description}</p>
      </CardContent>
    </Card>
  );
}

function MCPPluginCard({ plugin }: { plugin: MCPPlugin }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-5 w-5 text-muted-foreground" />
            {plugin.name}
          </CardTitle>
          <Badge variant="outline">{plugin.installCommand}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{plugin.description}</p>
      </CardContent>
    </Card>
  );
}

export function DeveloperTools({ agents, skills, loading = false }: DeveloperToolsProps) {
  return (
    <Tabs defaultValue="agents" className="w-full">
      <TabsList>
        <TabsTrigger value="agents" className="gap-2">
          <Bot className="h-4 w-4" />
          Agents
        </TabsTrigger>
        <TabsTrigger value="skills" className="gap-2">
          <Zap className="h-4 w-4" />
          Skills
        </TabsTrigger>
        <TabsTrigger value="mcp" className="gap-2">
          <Plug className="h-4 w-4" />
          MCP Plugins
        </TabsTrigger>
      </TabsList>

      <TabsContent value="agents" className="mt-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <AgentCardSkeleton />
              <AgentCardSkeleton />
              <AgentCardSkeleton />
            </>
          ) : agents.length > 0 ? (
            agents.map((agent) => <AgentCard key={agent.name} agent={agent} />)
          ) : (
            <p className="text-sm text-muted-foreground col-span-full">No agents available.</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="skills" className="mt-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <SkillCardSkeleton />
              <SkillCardSkeleton />
              <SkillCardSkeleton />
            </>
          ) : skills.length > 0 ? (
            skills.map((skill) => <SkillCard key={skill.name} skill={skill} />)
          ) : (
            <p className="text-sm text-muted-foreground col-span-full">No skills available.</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="mcp" className="mt-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mcpPlugins.map((plugin) => (
            <MCPPluginCard key={plugin.name} plugin={plugin} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
