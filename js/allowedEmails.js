/* ============================================
   ICC Social Hub — Email Allowlist
   Only emails listed here can log in.

   HOW TO ADD EMAILS:
   Just add a new line inside the array:
       "newemail@example.com",
   Trailing commas are fine. Order doesn't matter.
   ============================================ */

// ── To add more emails later, just append to this list ──
const _ALLOWED_EMAIL_LIST = [


    //  ADMIN ──
    "iccsocialhub@gmail.com",
    "sushmitha@inunity.in",

    // Test Account --
    "contact.designix@gmail.com",
    "idkwhythisemailloll@gmail.com",

    // ── Batch 1: Core Members ──
    "saravanantm1920@gmail.com",
    "chetansurya625v3@gmail.com",
    "rishikrishnarishi25@gmail.com",
    "vn.bhavika@gmail.com",
    "shreyame193@gmail.com",
    "vigneshkaushik17@gmail.com",
    "puneethagsksit@gmail.com",
    "sujay200731@gmail.com",
    "dithyasem2@gmail.com",
    "Sanchitburli002@gmail.com",
    "ntarun132007@gmail.com",
    "Shrujantejask@gmail.com",
    "hasini01032007@gmail.com",

    // ── Batch 2: Club Members ──
    "yashaswini.r608@gmail.com",
    "sowmyabojanapati@gmail.com",
    "rabeeakouser@gmail.com",
    "mohitha2402@gmail.com",
    "srushtiwali1404@gmail.com",
    "dhaathri1207@gmail.com",
    "ayeshazeba2020@gmail.com",
    "shravaniik1407@gmail.com",
    "sharathmuniyappa2007@gmail.com",
    "manishshirvi96@gmail.com",
    "divyaniranjan20611@gmail.com",
    "nikhil.nrtp995@gmail.com",
    "ghatagejayani@gmail.com",
    "dvmanassrujan@gmail.com",
    "hussainbasha7684@gmail.com",
    "svaishvi03@gmail.com",
    "amoghnhegde@gmail.com",
    "akshayg2040@gmail.com",
    "amoghkd2007@gmail.com",
    "krishnasarode2007@gmail.com",
    "mshahidafnan99@gmail.com",
    "kishanstar2007@gmail.com",
    "rachu.anil15@gmail.com",
    "adityahait2006@gmail.com",
    "armonika08@gmail.com",
    "ananyya.rajj@gmail.com",
    "vikasviki8147@gmail.com",
    "komalsai0401@gmail.com",
    "manvithsgr07@gmail.com",
    "madhushree.sm.61@gmail.com",
    "subramaninaidu71@gmail.com",
    "sohandadamode43@gmail.com",
    "vasisthanaveen10@gmail.com",
    "sanjay26srinivas07@gmail.com",
    "premshetty2106@gmail.com",
    "gururajmangalore377@gmail.com",
    "cvprajwalguptha379@gmail.com",
    "spoorthin684@gmail.com",
    "achyutahpadaki@gmail.com",
    "tanseerahmed138@gmail.com",
    "sinchana.sn.2007@gmail.com",
    "anirudhdhanraj77@gmail.com",
    "samhitha1310@gmail.com",
    "bgap13355@gmail.com",
    "chinmayachyutha.25@gmail.com",
    "abhayganesh15@gmail.com",
    "lchinmay32@gmail.com",
    "manjunathkolamali73@gmail.com",
    "amulya11g@gmail.com",
    "abhi.atria.002@gmail.com",
    "sourabh.bayari7002@gmail.com",
    "chandanalokesha.l2007@gmail.com",
    "raaga194@gmail.com",
    "renushivanna2401@gmail.com",
    "nitishgowda6363@gmail.com",
    "44.shashankp@gmail.com",
    "sanchitburli002@gmail.com",
    "ggouravnaresh@gmail.com",
    "gowthamnaresh3@gmail.com",
    "adi.nambiar29@gmail.com",
    "nethantd07@gmail.com",
    "purvibv1624@gmail.com",
    "dhanushshettyd2007@gmail.com",
    "sinchanarkashyap@gmail.com",
    "mohands0810@gmail.com",
    "karthikhadapad0@gmail.com",
    "sinchanshravya@gmail.com",
    "binitasai@gmail.com",
    "karthikhadapad0@gmail.com",
    "bhavanasreeni7@gmail.com",
    "cvprajwalguptha379@gmail.com",
    "pavanigowda875@gmail.com",
    "ranjithkumarbr2002@gmail.com",
    "kirthanvc07@gmail.com",
    "saravanantm3@gmail.com",
    "shreekishors776@gmail.com",
    "chinmayi.cks@gmail.com",
    "badris0620@gmail.com",
    "preethikumar8544@gmail.com",
    "gouthambg23@gmail.com",
    "kar2007thik@gmail.com",
    "suchitraparimi@gmail.com",
    "skandeshkrishnal@gmail.com",

];
// Internal lookup set (auto-built, case-insensitive — don't edit this)
const ALLOWED_EMAILS = new Set(_ALLOWED_EMAIL_LIST.map(e => e.trim().toLowerCase()));

/**
 * Returns true if the given email is on the allowlist.
 * Check is case-insensitive.
 */
function isEmailAllowed(email) {
    return ALLOWED_EMAILS.has(email.trim().toLowerCase());
}