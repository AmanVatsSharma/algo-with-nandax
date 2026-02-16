import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private assertOwnership(pathUserId: string, requesterUserId: string) {
    if (pathUserId !== requesterUserId) {
      throw new ForbiddenException('You are not allowed to access this user resource');
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    this.assertOwnership(id, req.user.userId);
    return this.usersService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Request() req, @Body() updateData: UpdateUserDto) {
    this.assertOwnership(id, req.user.userId);
    return this.usersService.update(id, updateData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    this.assertOwnership(id, req.user.userId);
    await this.usersService.delete(id);
    return { message: 'User deleted successfully' };
  }
}
