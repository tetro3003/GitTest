import acm.program.ConsoleProgram;

public class Pr24 extends ConsoleProgram {
	
	public void run(){
		
		int num = readInt("Enter Number: ");
		checker(num);
		
	}
	
	private void checker(int a){
		
		int c=0;
		
		for(int b=0; b<a; b++){
			
			if(a%(b+1)==0) {
				c++;
			}	
		}
		println(c);
	}
}
