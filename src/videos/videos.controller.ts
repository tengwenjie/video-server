import {
    Controller,
    Post,
    UploadedFiles,
    UploadedFile,
    UseInterceptors,
    Res,
    Body
  } from '@nestjs/common';
  import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
  import { diskStorage } from 'multer';
  import { Response } from 'express';
  import * as path from 'path';
  import * as fs from 'fs';
  import { exec } from 'child_process';
  import type { File as MulterFile } from 'multer'
  
  @Controller('videos')
  export class VideosController {
    @Post('merge')
    @UseInterceptors(
      FileFieldsInterceptor(
        [
          { name: 'videos', maxCount: 10 }
        ],
        {
          storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
              const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
              cb(null, uniqueSuffix + path.extname(file.originalname));
            }
          })
        }
      )
    )
    async mergeVideos(
        @UploadedFiles() files: { videos?: MulterFile[] },
      @Res() res: Response
    ) {
      if (!files || !files.videos || files.videos.length === 0) {
        return res.status(400).send('No videos uploaded.');
      }
  
      // 1. 生成 concat.txt
      const concatPath = path.join(process.cwd(), 'uploads', 'concat.txt');
      const listContent = files.videos.map(f => `file '${path.resolve(f.path)}'`).join('\n');
      fs.writeFileSync(concatPath, listContent);

  
      // 2. 合并输出路径
      const outputName = 'output_' + Date.now() + '.mp4';
      const outputPath = path.join(process.cwd(), 'uploads', outputName);
  
      // 3. ffmpeg 合并命令（用转码保证兼容性）
      const cmd = `ffmpeg -f concat -safe 0 -i "${concatPath}" -c:v libx264 -c:a aac -strict experimental "${outputPath}"`;
  
      try {
        await new Promise<void>((resolve, reject) => {
          exec(cmd, (err, stdout, stderr) => {
            // 清理上传和中间文件
            files.videos?.forEach(f => fs.unlinkSync(f.path));
            fs.unlinkSync(concatPath);
            if (err) {
              console.error(stderr);
              reject(err);
            } else {
              resolve();
            }
          });
        });
  
        // 4. 下载输出视频后删除
        res.download(outputPath, 'merged.mp4', (downloadErr) => {
          fs.unlinkSync(outputPath);
          if (downloadErr) {
            console.error('Download error:', downloadErr);
          }
        });
      } catch (err) {
        console.error('合并失败', err);
        res.status(500).send('合并失败');
      }
    }

    @Post('trim')
    @UseInterceptors(
        FileInterceptor('video', {
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
            }
        })
        })
    )
    async trimVideo(
        @UploadedFile() file: MulterFile,
        @Body('start') start: string,
        @Body('end') end: string,
        @Res() res: Response
      ) {
        if (!file) {
          return res.status(400).send('No video uploaded.');
        }
    
        const outputName = 'trimmed_' + Date.now() + '.mp4';
        const outputPath = path.join(process.cwd(), 'uploads', outputName);
    
        // 构建 ffmpeg 命令
        // -ss: 开始时间, -to: 结束时间
        const cmd = `ffmpeg -i "${file.path}" -ss ${start} -to ${end} -c:v libx264 -c:a aac -strict experimental "${outputPath}" -y`;
    
        try {
          await new Promise<void>((resolve, reject) => {
            exec(cmd, (err, stdout, stderr) => {
              // 删除上传的原始视频
              fs.unlinkSync(file.path);
              if (err) {
                console.error(stderr);
                reject(err);
              } else {
                resolve();
              }
            });
          });
    
          // 下载裁剪后的视频，并删除
          res.download(outputPath, 'trimmed.mp4', (downloadErr) => {
            fs.unlinkSync(outputPath);
            if (downloadErr) {
              console.error('Download error:', downloadErr);
            }
          });
        } catch (err) {
          console.error('裁剪失败', err);
          res.status(500).send('裁剪失败');
        }
      }
    
  }
  