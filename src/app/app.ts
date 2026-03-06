import {ChangeDetectionStrategy, Component} from '@angular/core';
import {Globe} from './globe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [Globe],
  template: `<app-globe></app-globe>`,
})
export class App {}
