import {useState} from "react";
import {useNavigate} from "react-router-dom";


export default function Register(){

const navigate = useNavigate();


const [username,setUsername] = useState("");
const [password,setPassword] = useState("");



const handleRegister = async()=>{


const response = await fetch(
"http://localhost:8000/api/register",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
username,
password
})
}
);



const data = await response.json();



if(data.success){

alert("สมัครสมาชิกสำเร็จ");

navigate("/login");


}else{

alert(data.message);

}


};



return(

<div>

<h1>Sign up</h1>


<input
placeholder="Username"
value={username}
onChange={(e)=>setUsername(e.target.value)}
/>


<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
/>


<button onClick={handleRegister}>
Register
</button>


</div>

)

}