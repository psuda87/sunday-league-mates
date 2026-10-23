import { readAccountBody, profilePhoto } from './profilePhotos';

test('limit zwykłego żądania działa także bez Content-Length',async()=>{
  const request=new Request('https://fixture.invalid',{method:'POST',body:'x'.repeat(12001)});
  await expect(readAccountBody(request,12000)).rejects.toMatchObject({status:413});
});
test('zdjęcie nigdy nie przyjmuje użytkownika ani ścieżki z klienta',async()=>{
  for(const body of [{user_id:'other'},{path:'other/photo.jpg'},{object_path:'other/photo.jpg'}])
    await expect(profilePhoto({url:'https://fixture.invalid',service:''},{id:'own',sid:'session'},'profile_photo_get',body)).rejects.toMatchObject({status:400});
});
