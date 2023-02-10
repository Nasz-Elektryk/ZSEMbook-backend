import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project-dto';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: DbService) {}
  getAllProjects(skip: number, take: number): Promise<any> {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }
  getProjectById(id: number): Promise<any> {
    return this.prisma.project.findUnique({ where: { id } });
  }
  async addProject(projectData: CreateProjectDto) {
    await this.prisma.project.create({ data: projectData });
  }
  async updateProjectById(projectData: UpdateProjectDto) {
    const { id } = projectData;
    await this.prisma.project.update({
      data: projectData,
      where: { id },
    });
  }
  async deleteProjectById(id: number) {
    await this.prisma.project.delete({ where: { id } });
  }
}