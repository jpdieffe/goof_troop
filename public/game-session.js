import {GatlingModel} from './gatling-model.js';
import {ZombieMode} from './zombie-mode.js';

export class GameSession extends GatlingModel{
  reset(){super.reset();this.gameMode=null;this.choosing=false;this.selection=0;this.lastMenuMask=0;this.menuDelay=20;this.pendingChoice=null;this.inputLock=false;this.zombie=null;}
  get blocksInput(){return this.choosing||this.inputLock||this.zombie?.phase==='preparing';}
  choose(mode){if(this.choosing&&['story','zombie'].includes(mode))this.pendingChoice=mode;}
  tick(r,masks){
    if(r[0xa0]!==8){if(this.gameMode||this.choosing)this.reset();return;}
    if(!this.gameMode){
      if(r[0xa2]!==4)return;
      if(!this.choosing){this.choosing=true;this.lastMenuMask=masks[0];this.savedFreeze=r[0xac];}
      r[0xac]=6;const edges=masks[0]&~this.lastMenuMask;this.lastMenuMask=masks[0];
      if(this.menuDelay>0)this.menuDelay--;
      else{if(edges&((1<<4)|(1<<5)))this.selection^=1;if(edges&((1<<3)|1|(1<<8)))this.pendingChoice=this.selection?'zombie':'story';}
      if(!this.pendingChoice)return;
      this.gameMode=this.pendingChoice;this.pendingChoice=null;this.choosing=false;this.inputLock=true;r[0xac]=this.savedFreeze;
      this.inventory.ground=[];
      if(this.gameMode==='zombie'){
        this.room=r[0xb6]*256+r[0xb7];this.active=true;this.terrain?.enter(r,this.room);this.inventory.limited=true;this.zombie=new ZombieMode();this.zombie.prepare(this,r);
      }
      return;
    }
    if(this.inputLock&&masks.every(m=>!m))this.inputLock=false;
    if(this.gameMode==='story')return;
    this.targetsSpawned=true;
    super.tick(r,this.blocksInput?[0,0]:masks);
    if(this.zombie&&this.active)this.zombie.tick(this,r);
  }
}
