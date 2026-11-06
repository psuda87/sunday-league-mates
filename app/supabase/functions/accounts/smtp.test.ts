import {describe,expect,it,vi} from 'vitest';
import {sendSmtp,smtpSettings} from './smtp';
import type {Mail,SmtpConnection} from './smtp';
const settings={host:'smtp.example.invalid',user:'fixture-user',password:'fixture-secret-only',from:'slm@example.invalid'};
const mail:Mail={to:'player@example.invalid',subject:'Potwierdź adres',text:'Fixture only\nhttps://slm.example.invalid/auth/callback#type=signup&token_hash=fixture',id:'msg_fixture'};
function connection(response='220 fixture\r\n250-fixture\r\n250 AUTH PLAIN\r\n235 ok\r\n250 ok\r\n250 ok\r\n354 continue\r\n250 queued\r\n'){
 let sent='',read=false;
 const c:SmtpConnection={read:vi.fn(async bytes=>{if(read)return null;read=true;const value=new TextEncoder().encode(response);bytes.set(value);return value.length;}),write:vi.fn(async bytes=>{sent+=new TextDecoder().decode(bytes);return bytes.length;}),close:vi.fn()};
 return {c,sent:()=>sent};
}
describe('SMTP implicit TLS465, bez połączenia sieciowego',()=>{
 it('używa wyłącznie connectTls na465 i potwierdza dopiero akceptację DATA',async()=>{
  const f=connection(),connect=vi.fn(async()=>f.c);await sendSmtp(settings,mail,connect);
  expect(connect).toHaveBeenCalledExactlyOnceWith({hostname:'smtp.example.invalid',port:465});
  expect(f.sent()).toContain('AUTH PLAIN ');expect(f.sent()).toContain('MAIL FROM:<slm@example.invalid>');expect(f.sent()).toContain('RCPT TO:<player@example.invalid>');
  expect(f.sent()).toContain('Content-Transfer-Encoding: base64');expect(f.sent()).not.toContain(mail.text);expect(f.c.close).toHaveBeenCalledOnce();
 });
 it.each(['535 rejected\r\n','220 ok\r\n550 denied\r\n','220 ok\r\n250 ok\r\n235 ok\r\n250 ok\r\n250 ok\r\n354 go\r\n550 rejected\r\n'])('nie uznaje odmowy serwera za wysłanie',async response=>{
  const f=connection(response);await expect(sendSmtp(settings,mail,async()=>f.c)).rejects.toThrow('mail_rejected');expect(f.c.close).toHaveBeenCalled();
 });
 it('odrzuca przerwany/niepoprawny protokół i zawsze zamyka połączenie',async()=>{
  const f=connection('220 incomplete');await expect(sendSmtp(settings,mail,async()=>f.c)).rejects.toThrow('mail_transport');expect(f.c.close).toHaveBeenCalled();
 });
 it('waliduje konfigurację i blokuje wstrzyknięcie nagłówków przed połączeniem',async()=>{
  const connect=vi.fn();
  expect(smtpSettings({...settings,host:'localhost'})).toBe(false);
  for(const from of ['bad\r\nRCPT TO:<other@example.invalid>','bad'])await expect(sendSmtp({...settings,from},mail,connect)).rejects.toThrow('mail_unconfigured');
  await expect(sendSmtp(settings,{...mail,to:'bad\r\nRCPT TO:<other@example.invalid>'},connect)).rejects.toThrow('mail_unconfigured');expect(connect).not.toHaveBeenCalled();
 });
 it('nie obchodzi błędu TLS innym transportem',async()=>{
  const connect=vi.fn(async()=>{throw Error('certificate verification failed');});await expect(sendSmtp(settings,mail,connect)).rejects.toThrow('certificate verification failed');expect(connect).toHaveBeenCalledOnce();
 });
 it('nie otwiera połączenia, jeśli wspólny budżet hooka już wygasł',async()=>{
  const controller=new AbortController(),connect=vi.fn();controller.abort();
  await expect(sendSmtp(settings,mail,connect,controller.signal)).rejects.toThrow('mail_timeout');expect(connect).not.toHaveBeenCalled();
 });
 it('timeout odrzuca operację także wtedy, gdy zamknięcie socketu zgłasza błąd',async()=>{
  const controller=new AbortController(),timeout=vi.spyOn(AbortSignal,'timeout').mockReturnValue(controller.signal);
  const f=connection();vi.mocked(f.c.read).mockImplementation(()=>new Promise(()=>{}));vi.mocked(f.c.close).mockImplementation(()=>{throw Error('already closed');});
  try{
   const flight=sendSmtp(settings,mail,async()=>f.c);
   const rejection=expect(flight).rejects.toThrow('mail_timeout');
   await vi.waitFor(()=>expect(f.c.read).toHaveBeenCalled());controller.abort();await rejection;
  }finally{timeout.mockRestore();}
 });
});
