import message from './message.js';
import {word} from './word.js';

console.log(message);
console.log(word);

let a = 1;
a++;
console.log(a);


new Promise((resoleve, reject) => {
    resoleve(1);
}).then((res) => {
    console.log(res);
})