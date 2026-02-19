import { create } from 'zustand'
import type { Project } from '@/types/index.ts'
import { projectService } from '@/services/index.ts'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null
  loading: boolean
  error: string | null
  loadProjects: () => Promise<void>
  loadActiveProject: () => Promise<void>
  setActiveProject: (projectId: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProject: null,
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await projectService.getProjects()
      set({ projects, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  loadActiveProject: async () => {
    set({ loading: true, error: null })
    try {
      const activeProject = await projectService.getActiveProject()
      set({ activeProject, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  setActiveProject: async (projectId) => {
    try {
      await projectService.setActiveProject(projectId)
      const activeProject = await projectService.getActiveProject()
      set({ activeProject })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },
}))
