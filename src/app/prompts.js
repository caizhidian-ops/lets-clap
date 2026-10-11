// All fixed child-facing voice lines live here; the review document is generated from this file.
export const prompts={
 select:{page:'宠物页',step:'选择性格',text:'你希望小伙伴是什么性格？欢快、安静，还是搞怪？',listen:true},
 guide:{page:'宠物页',step:'三小节唤醒',text:'小手掌亮起来时，跟着拍一下。一起拍三小节，唤醒小伙伴吧！'},
 name:{page:'宠物页',step:'取名字',text:'我醒啦！你想给我取什么名字？',listen:true},
 name_confirm:{page:'宠物页',step:'确认名字',text:'喜欢这个名字吗？点一下确认名字，我们就可以一起玩啦！'},
 home:{page:'宠物页',step:'已孵化首页',text:'今天想和我去大风车探险吗？你可以说，我们去探险吧！',listen:true},
 intro:{page:'探险页',step:'发现风车',text:'哇！前面有一个大风车！我们一起去看看吧！'},
 mood:{page:'探险页',step:'选择心情',text:'看到大风车，你是什么心情呀？开心、平静，还是兴奋？',listen:true},
 arranging:{page:'探险页',step:'编排等待',text:'让我把你的心情，变成一段拍手节奏。'},
 demo:{page:'探险页',step:'两小节示范',text:'先听我拍一遍。小手掌亮起来的地方，就是拍手的位置。'},
 ready:{page:'探险页',step:'示范后互动',text:'想试试吗？也可以告诉我，简单一点、慢一点，或者再听一次。',listen:true},
 challenge:{page:'探险页',step:'确认开始挑战',text:'准备好了，就点开始挑战。戴上耳机，我们把拍手声录下来。'},
 record:{page:'探险页',step:'录音前说明',text:'先听四拍，再轮到你。看着亮灯拍手，我会安静地听。'},
 analyzing:{page:'探险页',step:'真实录音分析',text:'拍手录好啦！让我听听你的节奏。'},
 feedback:{page:'探险页',step:'反馈后的选择',text:'想再练一次，还是听听自己的拍手？也可以点保留这次。',listen:true},
 keep:{page:'探险页',step:'确认保留作品',text:'喜欢这次拍手，就点保留这次，我们一起听听你的作品。'},
 work:{page:'探险页',step:'作品试听',text:'这是你的大风车拍手片段！想听听吗？你也可以说，再练一次。',listen:true},
 no_speech:{page:'通用',step:'没有听清',text:'我还没听清。准备好时，再点一下麦克风告诉我吧。'}
};
export const promptForState={HATCH_SELECT:'select',PET_NAMING:'name',PET_HOME:'home',ADVENTURE_INTRO:'intro',MOOD_SELECT:'mood',ARRANGEMENT_LOADING:'arranging',ANALYZING:'analyzing',FEEDBACK:'feedback',WORK_PREVIEW:'work'};
