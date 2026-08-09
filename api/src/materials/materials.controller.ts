import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { MaterialsService } from './materials.service';
import type { UploadedFileLike } from './materials.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get('courses/:courseId/materials')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  list(@Param('courseId') courseId: string) {
    return this.materials.list(courseId);
  }

  @Post('courses/:courseId/materials')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  upload(
    @Param('courseId') courseId: string,
    @UploadedFile() file: UploadedFileLike,
    @Req() req: Request,
  ) {
    const body = (req.body ?? {}) as { title?: string };
    const user = (req as unknown as { user?: { id?: string } }).user;
    return this.materials.create(courseId, file, body.title, user?.id);
  }

  @Get('materials/:id/download')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { buf, mime, filename } = await this.materials.download(id);
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.send(buf);
  }

  @Delete('materials/:id')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  remove(@Param('id') id: string) {
    return this.materials.remove(id);
  }
}
