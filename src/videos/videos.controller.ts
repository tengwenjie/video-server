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

      // 路径设置
      const base = path.parse(file.path).name;
      const ext = path.extname(file.path);
      const part1 = path.join(process.cwd(), 'uploads', `${base}_part1${ext}`);
      const part2 = path.join(process.cwd(), 'uploads', `${base}_part2${ext}`);
      const listPath = path.join(process.cwd(), 'uploads', `${base}_concat.txt`);
      const outputName = `trimmed_${Date.now()}${ext}`;
      const outputPath = path.join(process.cwd(), 'uploads', outputName);

      try {
        // 1. 提取 [0, start)
        await new Promise<void>((resolve, reject) => {
          exec(`ffmpeg -i "${file.path}" -t ${start} -c copy "${part1}" -y`, (err) => {
            if (err) return reject(err); resolve();
          });
        });

        // 2. 提取 [end, 视频结束)
        await new Promise<void>((resolve, reject) => {
          exec(`ffmpeg -i "${file.path}" -ss ${end} -c copy "${part2}" -y`, (err) => {
            if (err) return reject(err); resolve();
          });
        });

        // 3. 生成 concat.txt
        fs.writeFileSync(listPath, `file '${part1}'\nfile '${part2}'\n`);

        // 4. 拼接两段并转码
        await new Promise<void>((resolve, reject) => {
          exec(`ffmpeg -f concat -safe 0 -i "${listPath}" -c:v libx264 -c:a aac -strict experimental "${outputPath}" -y`, (err) => {
            if (err) return reject(err); resolve();
          });
        });

        // 5. 删除临时文件
        fs.unlinkSync(file.path);
        fs.unlinkSync(part1);
        fs.unlinkSync(part2);
        fs.unlinkSync(listPath);

        // 6. 下载并删除输出
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
  