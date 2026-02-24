import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => this.convertBigInt(data)),
    );
  }

  private convertBigInt(value: any): any {
    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.convertBigInt(v));
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      const newObj: any = {};
      for (const key in value) {
        newObj[key] = this.convertBigInt(value[key]);
      }
      return newObj;
    }

    return value;
  }
}