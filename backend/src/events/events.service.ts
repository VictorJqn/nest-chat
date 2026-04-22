import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type UserUpdatedEvt = {
  id: string;
  email: string;
  name: string | null;
  color: string;
};

@Injectable()
export class AppEvents {
  private bus = new EventEmitter();

  pushUserUpdated(user: UserUpdatedEvt) {
    this.bus.emit('user:updated', user);
  }

  onUserUpdated(cb: (user: UserUpdatedEvt) => void) {
    this.bus.on('user:updated', cb);
  }
}
