import acm.program.ConsoleProgram;

public class Pr28 extends ConsoleProgram {
	
	public void run(){
		
		int a = 0;
		int c = 0;
		
		while(a==0){
			
			int b = readInt("Enter Number: ");
			
			if(b==-1){
				println(c);
				break;
			}
			
			if(b%2==0){
				c += 1;
			}
			
			
			
		}
		
		
	}

}
