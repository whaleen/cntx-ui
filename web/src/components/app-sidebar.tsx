"use client"

import * as React from "react"
import {
  Boxes,
  CheckCircle,
  HelpCircle,
  Settings,
  SquaresUnite,
  DatabaseZap,
  Database,
  Command,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  projectName: string
  version: string
  mcpStatus: string
  activeSection: string
  onSectionChange: (id: string) => void
}

export function AppSidebar({ 
  projectName, 
  version, 
  mcpStatus, 
  activeSection, 
  onSectionChange, 
  ...props 
}: AppSidebarProps) {
  
  const data = {
    user: {
      name: "josh",
      email: "josh@whaleen.ai",
      avatar: "/josh.png",
    },
    teams: [
      {
        name: projectName,
        logo: Command,
        plan: `cntx-ui ${version}`,
      }
    ],
    navMain: [
      {
        title: "Intelligence",
        url: "#",
        icon: SquaresUnite,
        isActive: true,
        items: [
          { id: 'bundles', title: 'Bundles & Files', url: '#' },
          { id: 'semantic', title: 'Semantic Chunks', url: '#' },
          { id: 'vector-db', title: 'Vector Database', url: '#' },
          { id: 'database', title: 'SQLite Database', url: '#' }
        ]
      },
      {
        title: "Configuration",
        url: "#",
        icon: Settings,
        items: [
          { id: 'settings', title: 'Bundle Rules', url: '#' },
          { id: 'system-status', title: 'System Health', url: '#' }
        ]
      }
    ],
    projects: [
      {
        name: "Documentation",
        url: "#",
        id: "help",
        icon: HelpCircle,
      }
    ]
  }

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain 
          items={data.navMain} 
          activeSection={activeSection}
          onSectionChange={onSectionChange}
        />
        <NavProjects 
          projects={data.projects} 
          activeSection={activeSection}
          onSectionChange={onSectionChange}
        />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
