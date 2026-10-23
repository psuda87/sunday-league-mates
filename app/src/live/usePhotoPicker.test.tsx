import { act, renderHook } from '@testing-library/react';
import type { SessionManager, SessionPhase } from '../auth/sessionManager';
import { usePhotoPicker } from './usePhotoPicker';

test('wynik galerii czeka na ponowne potwierdzenie sesji tego samego konta',()=>{
  const manager={getSnapshot:()=>({phase:'ready',session:{user_id:'owner'}})} as unknown as SessionManager;
  const {result,rerender}=renderHook(({phase,userId})=>usePhotoPicker(manager,phase,userId),{initialProps:{phase:'ready' as SessionPhase,userId:'owner'}});
  act(()=>result.current.choose());
  rerender({phase:'checking',userId:''});
  const file=new File(['synthetic'],'fixture.png',{type:'image/png'});
  act(()=>result.current.input.props.onChange({target:{files:[file],value:'fixture.png'}}));
  expect(result.current.file).toBeUndefined();
  rerender({phase:'ready',userId:'owner'});
  expect(result.current.file).toBe(file);
  act(()=>result.current.consumed());
  expect(result.current.file).toBeUndefined();
});

test('wylogowanie odrzuca spóźniony wynik galerii zamiast przekazywać go innemu kontu',()=>{
  const manager={getSnapshot:()=>({phase:'ready',session:{user_id:'owner'}})} as unknown as SessionManager;
  const {result,rerender}=renderHook(({phase,userId})=>usePhotoPicker(manager,phase,userId),{initialProps:{phase:'ready' as SessionPhase,userId:'owner'}});
  act(()=>result.current.choose());
  rerender({phase:'signed_out',userId:''});
  act(()=>result.current.input.props.onChange({target:{files:[new File(['synthetic'],'fixture.png')],value:'fixture.png'}}));
  rerender({phase:'ready',userId:'other'});
  expect(result.current.file).toBeUndefined();
});
