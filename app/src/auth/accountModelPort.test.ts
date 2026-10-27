import {expect,it,vi} from 'vitest';
import {b1Port} from './b1Port';
import type {SessionManager} from './sessionManager';
it('registration retry retains capability/id without storing password in retry identity',async()=>{
 const manager={signIn:vi.fn().mockResolvedValue(undefined)} as unknown as SessionManager;
 const request=vi.fn().mockRejectedValueOnce(Error('lost response')).mockResolvedValue({registered:true,user_id:'expected-uuid',nickname:'CurrentNick'});
 const port=b1Port(manager,true,request);
 const p={nickname:'NewNick',fullName:'',phone:''};
 await expect(port.signUp(p,'','TemporaryOnlyTest9!')).rejects.toThrow();await port.signUp(p,'','TemporaryOnlyTest9!');
 expect(request.mock.calls[0][1].request_id).toBe(request.mock.calls[1][1].request_id);
 expect(request.mock.calls[0][1].request_secret).toBe(request.mock.calls[1][1].request_secret);
 expect(manager.signIn).toHaveBeenCalledWith('CurrentNick','TemporaryOnlyTest9!','expected-uuid');
});
