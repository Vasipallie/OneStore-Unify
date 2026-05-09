import express from 'express';
import cookieParser from 'cookie-parser';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
import { generate, count } from "random-words";
const __dirname = dirname(fileURLToPath(import.meta.url));
import { createClient } from '@supabase/supabase-js';
import bodyParser from 'body-parser';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cookieParser());
const supabase = createClient(process.env.supaURL, process.env.supaKEY);
const crypto = await import('crypto');

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'views')));
app.use(bodyParser.urlencoded({ extended: true }));

function passgen(num){
    return crypto.randomBytes(num).toString('hex');
}

function getfernet(keyphrase){
    const keyphrasee = Buffer.from(keyphrase, 'utf-8');
    const fernetkey = crypto.createHash('sha256').update(keyphrasee).digest();
    return fernetkey;
}

function ferncrypt(keyphrase, data){
    const fernetkey = getfernet(keyphrase);
    let ciphertext = crypto.createCipheriv('aes-256-cbc', fernetkey, Buffer.alloc(16, 0));
    let encrypted = ciphertext.update(data, 'utf-8', 'hex');
    encrypted += ciphertext.final('hex');
    return encrypted;
}

function fdrecrypt(keyphrase, encrypte){
    const fernkey = getfernet(keyphrase);
    const plain = crypto.createDecipheriv('aes-256-cbc', fernkey, Buffer.alloc(16, 0));
    let decrypted = plain.update(encrypte, 'hex', 'utf-8');
    decrypted += plain.final('utf-8');
    return decrypted;
}




app.route('/').get((req, res) => {
    res.render('index');
});
app.route('/login').get((req, res) => {
    const session = req.cookies.session;
    if (session){
        supabase.auth.setSession(session).then(({data,error}) =>{
            if (error){
                console.error('session error:', error);
                res.clearCookie('session');
                res.render('login', { error: 'Session expired. Please log in again.' });
            }else{
                res.render('dashboard');
            }
        })
    }
    else{
        res.render('login');
    }

});
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const {data, error} = await supabase.auth.signInWithPassword({email, password});
    if (error){
        console.error('login error:', error);
        res.status(401).render('login', { error: 'Invalid email or password' });
    }else{
        // ADD DASHBOARD LOGIC PLEASE 😭
        res.cookie('session', data.session, { httpOnly: true });
        res.render('dashboard');
    }
});
app.route('/create').get((req, res) =>{
    res.render('signup');
});
app.post('/create', async (req, res) =>{
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error){
        console.error('signup error:', error);
        res.status(400).render('signup', { error: 'Error creating account. Please try again.' });
    }else{
    const salt = passgen(16);
    const key1 = generate({minLength:4});
    const key2 = generate({minLength:4});
    const key3 = generate({minLength:4});
    const key4 = generate({minLength:4});
    const key5 = generate({minLength:4});
    const key6 = generate({minLength:4});
    const keyphrase = [key1, key2, key3, key4, key5, key6].join('');
    const hash = crypto.createHash('sha256').update(keyphrase + salt).digest('hex');
    const useruid = data.user.id;
    const { data: insertData, error: insertError } = await supabase.from('users').insert({ keyhash: hash, useruid: useruid, salt: salt });
    if (insertError){
        console.error('database error:', insertError);
        res.status(500).render('signup', { error: 'Error saving keyphrase. Please try again.' });
    }else{
        res.cookie('session', data.session, { httpOnly: true });
        res.cookie('keyphrase', keyphrase, { httpOnly: true });
        res.render('keydisp', { key1, key2, key3, key4, key5, key6 });
    }
}});
app.route('/logout').get((req, res) =>{
    res.clearCookie('session');
    res.clearCookie('keyphrase');
    res.render('logout');
});
app.post('/keyauth', (req, res) =>{
    const { key1, key2, key3, key4, key5, key6 } = req.body;
    const keyphrase = [key1, key2, key3, key4, key5, key6].join('');
    const session = req.cookies.session;

});
app.route('/keyauth').get((req, res) =>{
    res.render('keyauth');
});


/*
THIS IS THE 404 ROUTE
>>>DO NOT ADD ANYTHING BEYOND THIS<<<
*/
app.route('/:id').get((req, res) => {
    res.status(404).render('404');
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});