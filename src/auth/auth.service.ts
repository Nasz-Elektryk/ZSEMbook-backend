import { ForbiddenException, Injectable } from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto';
import { DbService } from '../db/db.service';
import { sha512 } from 'js-sha512';
import {
  AccountTools,
  Keystore,
  registerAccount,
  VulcanHebe,
} from 'vulcan-api-js';
import { Response } from 'express';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    private prisma: DbService,
    private readonly mailerService: MailerService,
  ) {}

  async signup(dto: RegisterDto): Promise<object> {
    const sampleUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            username: dto.username,
          },
          {
            email: dto.email,
          },
        ],
      },
    });
    if (sampleUser) throw new ForbiddenException('Credentials taken!');

    const keystore = new Keystore();
    await keystore.init('Muj Elektryk');

    const vulcanAccount = await registerAccount(
      keystore,
      dto.token,
      dto.symbol,
      dto.pin,
    );
    const vulcanClient = new VulcanHebe(
      keystore,
      AccountTools.loadFromObject(vulcanAccount),
    );
    await vulcanClient.selectStudent();

    const student = (await vulcanClient.getStudents())[0];
    const lesson = (await vulcanClient.getLessons(new Date('2022-09-02')))[0];
    const classNumber = student.periods.at(-1)?.level;

    const restURL = await this.prisma.restURL.upsert({
      create: {
        url: vulcanAccount.restUrl,
      },
      where: {
        url: vulcanAccount.restUrl,
      },
      update: {},
    });

    const user = await this.prisma.user.create({
      data: {
        name: student.pupil.firstName,
        username: dto.username,
        surname: student.pupil.surname,
        class_name:
          classNumber && lesson.class?.symbol
            ? classNumber + lesson.class.symbol
            : '',
        passwordHash: sha512(dto.password),
        profileDesc: '',
        avatar: '',
        postsProjects: '',
        skills: '',
        profileSettings: '',
        restURLId: restURL.id,
        loginID: vulcanAccount.loginId,
        email: dto.email,
        certificate: keystore.certificate ?? '',
        fingerprint: keystore.fingerprint ?? '',
        privateKey: keystore.privateKey ?? '',
        firebaseToken: keystore.firebaseToken ?? '',
      },
    });

    /* generating tempID */
    const tempUser = await this.prisma.unverifiedUser.create({
      data: {
        tempId: sha512(String(user.id)),
        userId: user.id,
      },
    });

    const emailHTML = `
       <h1>Witaj na najlepszej platformie społecznościowej - Muj Elektryk!</h1>
       <p><a href="http://localhost:3000/auth/verify/${tempUser.tempId}">Potwierdź konto</a></p>
    `;
    /* sending confirmation email */
    await this.mailerService.sendMail({
      to: dto.email,
      from: 'noreply@muj-elektryk.com',
      subject: 'Potwierdzenie adresu email w serwisie Muj Elektryk',
      html: emailHTML,
    });

    return { msg: 'Successfully registered a new account!' };
  }

  async login(dto: LoginDto, res: Response): Promise<Response> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
    });

    if (sha512(dto.password) === user.passwordHash) {
      res.cookie('test', 'value', { httpOnly: true });
      return res;
    }
    throw new ForbiddenException('Wrong credentials!');
  }

  async verify(id: string, res: Response): Promise<Response> {
    const unverifiedUser = await this.prisma.unverifiedUser.findUniqueOrThrow({
      where: {
        tempId: id,
      },
    });

    await this.prisma.user.update({
      where: {
        id: unverifiedUser.userId,
      },
      data: {
        isVerified: true,
      },
    });

    await this.prisma.unverifiedUser.delete({
      where: {
        tempId: id,
      },
    });

    res.cookie('test', 'value', { httpOnly: true });
    return res;
  }
}
