const fs=require('node:fs');
const path=require('node:path');
const source=path.dirname(require.resolve('@fontsource-variable/noto-sans-sc/package.json'));
const destination=path.join(__dirname,'../assets/fonts');
fs.mkdirSync(destination,{recursive:true});
fs.writeFileSync(path.join(destination,'noto.css'),fs.readFileSync(path.join(source,'index.css'),'utf8').replaceAll('Noto Sans SC Variable','Camp Sans'));
fs.copyFileSync(path.join(source,'LICENSE'),path.join(destination,'OFL.txt'));
fs.cpSync(path.join(source,'files'),path.join(destination,'files'),{recursive:true});
console.log('Bundled Noto Sans SC variable font and OFL license.');
